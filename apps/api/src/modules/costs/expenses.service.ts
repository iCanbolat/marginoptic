import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Queue } from "bullmq";
import { and, asc, between, desc, eq } from "drizzle-orm";
import type {
  CustomExpenseInput,
  CustomExpenseSummary,
  CustomExpenseUpdate,
  ExpenseAllocationRow,
} from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import {
  customExpenses,
  expenseAllocations,
} from "../../database/schema/costs";
import { channels } from "../../database/schema/channels";
import {
  MaterializeExpenseJob,
  QUEUE_RECURRING_EXPENSES,
} from "./costs.constants";
import { buildAllocations } from "./expense-materializer";

type ExpenseRow = typeof customExpenses.$inferSelect;

function toSummary(r: ExpenseRow): CustomExpenseSummary {
  return {
    id: r.id,
    storeId: r.storeId,
    channelId: r.channelId,
    name: r.name,
    category: r.category,
    type: r.type,
    recurrence: r.recurrence,
    allocation: r.allocation,
    amount: r.amount,
    currency: r.currency,
    startDate: r.startDate,
    endDate: r.endDate,
    active: r.active,
    updatedAt: r.updatedAt.toISOString(),
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class ExpensesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectQueue(QUEUE_RECURRING_EXPENSES)
    private readonly queue: Queue<MaterializeExpenseJob>,
  ) {}

  async list(
    storeId: string,
    channelId?: string,
  ): Promise<CustomExpenseSummary[]> {
    const conds = [eq(customExpenses.storeId, storeId)];
    if (channelId) conds.push(eq(customExpenses.channelId, channelId));
    const rows = await this.db
      .select()
      .from(customExpenses)
      .where(and(...conds))
      .orderBy(desc(customExpenses.createdAt));
    return rows.map(toSummary);
  }

  /** Giderin org'a ait olduğunu doğrular (yoksa 404); controller manuel tetikleme için. */
  async assertOwned(storeId: string, id: string): Promise<void> {
    await this.loadOwned(storeId, id);
  }

  /** Giderin org'a ait olduğunu doğrular (yoksa 404). */
  private async loadOwned(storeId: string, id: string): Promise<ExpenseRow> {
    const [row] = await this.db
      .select()
      .from(customExpenses)
      .where(
        and(eq(customExpenses.id, id), eq(customExpenses.storeId, storeId)),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Gider bulunamadı");
    return row;
  }

  /** channelId verildiyse org'a ait olduğunu doğrular. */
  private async assertStoreOwned(storeId: string, channelId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: channels.id })
      .from(channels)
      .where(and(eq(channels.id, channelId), eq(channels.storeId, storeId)))
      .limit(1);
    if (!row) throw new NotFoundException("Mağaza bulunamadı");
  }

  async create(
    storeId: string,
    dto: CustomExpenseInput,
  ): Promise<CustomExpenseSummary> {
    if (dto.channelId) await this.assertStoreOwned(storeId, dto.channelId);
    const [row] = await this.db
      .insert(customExpenses)
      .values({
        storeId: storeId,
        channelId: dto.allocation === "store" ? (dto.channelId ?? null) : null,
        name: dto.name,
        category: dto.category ?? null,
        type: dto.type,
        recurrence: dto.type === "recurring" ? (dto.recurrence ?? null) : null,
        allocation: dto.allocation,
        amount: dto.amount,
        currency: dto.currency,
        startDate: dto.startDate,
        endDate: dto.endDate ?? null,
        active: dto.active,
      })
      .returning();
    // Geçmiş günleri hemen materialize et (oluşturulduğu güne kadar).
    await this.enqueueMaterialize(row!.id, row!.startDate, todayIso());
    return toSummary(row!);
  }

  async update(
    storeId: string,
    id: string,
    dto: CustomExpenseUpdate,
  ): Promise<CustomExpenseSummary> {
    await this.loadOwned(storeId, id);
    const set: Partial<typeof customExpenses.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (dto.name !== undefined) set.name = dto.name;
    if ("category" in dto) set.category = dto.category ?? null;
    if (dto.amount !== undefined) set.amount = dto.amount;
    if (dto.currency !== undefined) set.currency = dto.currency;
    if (dto.startDate !== undefined) set.startDate = dto.startDate;
    if ("endDate" in dto) set.endDate = dto.endDate ?? null;
    if (dto.active !== undefined) set.active = dto.active;

    const [row] = await this.db
      .update(customExpenses)
      .set(set)
      .where(
        and(eq(customExpenses.id, id), eq(customExpenses.storeId, storeId)),
      )
      .returning();
    if (!row) throw new NotFoundException("Gider bulunamadı");

    // Tutar/tarih/aktiflik değişmiş olabilir → eski materializasyonu temizle, yeniden hesapla.
    await this.db
      .delete(expenseAllocations)
      .where(eq(expenseAllocations.customExpenseId, id));
    await this.enqueueMaterialize(id, row.startDate, todayIso());
    return toSummary(row);
  }

  async remove(storeId: string, id: string): Promise<void> {
    await this.loadOwned(storeId, id);
    await this.db
      .delete(customExpenses)
      .where(
        and(eq(customExpenses.id, id), eq(customExpenses.storeId, storeId)),
      );
  }

  async listAllocations(
    storeId: string,
    id: string,
    from: string,
    to: string,
  ): Promise<ExpenseAllocationRow[]> {
    await this.loadOwned(storeId, id);
    const rows = await this.db
      .select({
        channelId: expenseAllocations.channelId,
        date: expenseAllocations.date,
        amount: expenseAllocations.amount,
        currency: expenseAllocations.currency,
      })
      .from(expenseAllocations)
      .where(
        and(
          eq(expenseAllocations.customExpenseId, id),
          between(expenseAllocations.date, from, to),
        ),
      )
      .orderBy(asc(expenseAllocations.date), asc(expenseAllocations.channelId));
    return rows;
  }

  /** Materialize işini kuyruğa alır (controller manuel tetikleme + create/update sonrası). */
  async enqueueMaterialize(
    customExpenseId: string,
    from: string,
    to: string,
  ): Promise<void> {
    // Not: BullMQ custom jobId ':' içeremez → '_' ile ayır.
    await this.queue.add(
      "materialize",
      { customExpenseId, from, to },
      { jobId: `materialize_${customExpenseId}_${from}_${to}` },
    );
  }

  // ---- processor tarafından çağrılır (DB yazımı) ----

  /** Hedef mağazalar: store → [channelId]; spread → org'un aktif mağazaları. */
  private async targetStoreIds(expense: ExpenseRow): Promise<string[]> {
    if (expense.allocation === "store") {
      return expense.channelId ? [expense.channelId] : [];
    }
    const rows = await this.db
      .select({ id: channels.id })
      .from(channels)
      .where(
        and(
          eq(channels.storeId, expense.storeId),
          eq(channels.status, "active"),
        ),
      );
    return rows.map((r) => r.id);
  }

  /** Tek bir gideri [from, to] (bugüne kadar) günlerine materialize eder (idempotent). */
  async materialize(
    customExpenseId: string,
    from: string,
    to: string,
  ): Promise<number> {
    const [expense] = await this.db
      .select()
      .from(customExpenses)
      .where(eq(customExpenses.id, customExpenseId))
      .limit(1);
    if (!expense || !expense.active) {
      // Aktif değilse materializasyonu temizle.
      await this.db
        .delete(expenseAllocations)
        .where(eq(expenseAllocations.customExpenseId, customExpenseId));
      return 0;
    }

    const today = todayIso();
    const cappedTo = to > today ? today : to;
    if (from > cappedTo) return 0;

    const storeIds = await this.targetStoreIds(expense);
    const allocations = buildAllocations(expense, from, cappedTo, storeIds);

    await this.db.transaction(async (tx) => {
      // İlgili aralığı temizle (idempotent yeniden yazım).
      await tx
        .delete(expenseAllocations)
        .where(
          and(
            eq(expenseAllocations.customExpenseId, customExpenseId),
            between(expenseAllocations.date, from, cappedTo),
          ),
        );
      if (allocations.length > 0) {
        await tx.insert(expenseAllocations).values(
          allocations.map((a) => ({
            customExpenseId,
            channelId: a.channelId,
            date: a.date,
            amount: a.amount,
            currency: expense.currency,
          })),
        );
      }
    });
    return allocations.length;
  }

  /** Günlük scheduler: tüm aktif giderleri [from, to] aralığında materialize eder. */
  async materializeAllActive(from: string, to: string): Promise<number> {
    const active = await this.db
      .select({ id: customExpenses.id })
      .from(customExpenses)
      .where(eq(customExpenses.active, true));
    let total = 0;
    for (const e of active) {
      total += await this.materialize(e.id, from, to);
    }
    return total;
  }
}
