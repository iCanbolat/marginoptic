import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type {
  CogsCsvImportInput,
  CogsCsvImportResult,
  CogsCsvRowResult,
  CogsRuleInput,
  CogsRuleSummary,
  CogsRuleUpdate,
} from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { cogsRules } from "../../database/schema/costs";
import { parseCogsCsv } from "./cogs-csv";
import { assertStoreInOrg } from "./store-access";

type CogsRow = typeof cogsRules.$inferSelect;

function toSummary(r: CogsRow): CogsRuleSummary {
  return {
    id: r.id,
    channelId: r.channelId,
    scope: r.scope,
    matchValue: r.matchValue,
    country: r.country,
    minQty: r.minQty,
    costAmount: r.costAmount,
    handlingFee: r.handlingFee,
    currency: r.currency,
    effectiveFrom: r.effectiveFrom?.toISOString() ?? null,
    effectiveTo: r.effectiveTo?.toISOString() ?? null,
    source: r.source,
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** CSV upsert anahtarı: aynı sku/ülke/qty/etkin-tarih kuralı tekildir. */
function ruleKey(
  matchValue: string | null,
  country: string | null,
  minQty: number,
  effectiveFrom: Date | null,
): string {
  return `${matchValue ?? ""}|${country ?? ""}|${minQty}|${effectiveFrom?.toISOString() ?? ""}`;
}

@Injectable()
export class CogsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async list(storeId: string, channelId: string): Promise<CogsRuleSummary[]> {
    await assertStoreInOrg(this.db, storeId, channelId);
    const rows = await this.db
      .select()
      .from(cogsRules)
      .where(eq(cogsRules.channelId, channelId))
      .orderBy(cogsRules.scope, cogsRules.matchValue);
    return rows.map(toSummary);
  }

  async create(
    storeId: string,
    channelId: string,
    dto: CogsRuleInput,
  ): Promise<CogsRuleSummary> {
    const store = await assertStoreInOrg(this.db, storeId, channelId);
    const [row] = await this.db
      .insert(cogsRules)
      .values({
        channelId,
        scope: dto.scope,
        matchValue: dto.scope === "global" ? null : (dto.matchValue ?? null),
        country: dto.country ?? null,
        minQty: dto.minQty,
        costAmount: dto.costAmount,
        handlingFee: dto.handlingFee ?? null,
        currency: dto.currency ?? store.currency,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        source: "manual",
      })
      .returning();
    return toSummary(row!);
  }

  /** Toplu ekleme: tek INSERT ifadesi (atomik). */
  async createMany(
    storeId: string,
    channelId: string,
    dtos: CogsRuleInput[],
  ): Promise<CogsRuleSummary[]> {
    const store = await assertStoreInOrg(this.db, storeId, channelId);
    const values: (typeof cogsRules.$inferInsert)[] = dtos.map((dto) => ({
      channelId,
      scope: dto.scope,
      matchValue: dto.scope === "global" ? null : (dto.matchValue ?? null),
      country: dto.country ?? null,
      minQty: dto.minQty,
      costAmount: dto.costAmount,
      handlingFee: dto.handlingFee ?? null,
      currency: dto.currency ?? store.currency,
      effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
      effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
      source: "manual",
    }));
    const rows = await this.db.insert(cogsRules).values(values).returning();
    return rows.map(toSummary);
  }

  async update(
    storeId: string,
    channelId: string,
    id: string,
    dto: CogsRuleUpdate,
  ): Promise<CogsRuleSummary> {
    await assertStoreInOrg(this.db, storeId, channelId);
    const set: Partial<typeof cogsRules.$inferInsert> = { updatedAt: new Date() };
    if ("matchValue" in dto) set.matchValue = dto.matchValue ?? null;
    if ("country" in dto) set.country = dto.country ?? null;
    if (dto.minQty !== undefined) set.minQty = dto.minQty;
    if (dto.costAmount !== undefined) set.costAmount = dto.costAmount;
    if ("handlingFee" in dto) set.handlingFee = dto.handlingFee ?? null;
    if ("currency" in dto) set.currency = dto.currency ?? null;
    if ("effectiveFrom" in dto) {
      set.effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : null;
    }
    if ("effectiveTo" in dto) {
      set.effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    }

    const [row] = await this.db
      .update(cogsRules)
      .set(set)
      .where(and(eq(cogsRules.id, id), eq(cogsRules.channelId, channelId)))
      .returning();
    if (!row) throw new NotFoundException("COGS kuralı bulunamadı");
    return toSummary(row);
  }

  async remove(storeId: string, channelId: string, id: string): Promise<void> {
    await assertStoreInOrg(this.db, storeId, channelId);
    const deleted = await this.db
      .delete(cogsRules)
      .where(and(eq(cogsRules.id, id), eq(cogsRules.channelId, channelId)))
      .returning({ id: cogsRules.id });
    if (deleted.length === 0) {
      throw new NotFoundException("COGS kuralı bulunamadı");
    }
  }

  /** Toplu COGS CSV içe-aktarımı (dryRun=true → yalnız önizleme/doğrulama). */
  async importCsv(
    storeId: string,
    channelId: string,
    dto: CogsCsvImportInput,
  ): Promise<CogsCsvImportResult> {
    const store = await assertStoreInOrg(this.db, storeId, channelId);
    const { rows, headerError } = parseCogsCsv(dto.csv);
    if (headerError) throw new BadRequestException(headerError);

    const results: CogsCsvRowResult[] = rows.map((r) => ({
      line: r.line,
      sku: r.sku,
      costAmount: r.costAmount,
      handlingFee: r.handlingFee,
      valid: r.valid,
      error: r.error,
    }));
    const validRows = rows.filter((r) => r.valid);
    let imported = 0;

    if (!dto.dryRun && validRows.length > 0) {
      await this.db.transaction(async (tx) => {
        const existing = await tx
          .select({
            id: cogsRules.id,
            matchValue: cogsRules.matchValue,
            country: cogsRules.country,
            minQty: cogsRules.minQty,
            effectiveFrom: cogsRules.effectiveFrom,
          })
          .from(cogsRules)
          .where(
            and(eq(cogsRules.channelId, channelId), eq(cogsRules.scope, "sku")),
          );
        const byKey = new Map(
          existing.map((r) => [
            ruleKey(r.matchValue, r.country, r.minQty, r.effectiveFrom),
            r.id,
          ]),
        );

        const toInsert: (typeof cogsRules.$inferInsert)[] = [];
        for (const row of validRows) {
          const key = ruleKey(row.sku, row.country, row.minQty, null);
          const existingId = byKey.get(key);
          const currency = row.currency ?? store.currency;
          if (existingId) {
            await tx
              .update(cogsRules)
              .set({
                costAmount: row.costAmount!,
                handlingFee: row.handlingFee,
                currency,
                source: "csv",
                updatedAt: new Date(),
              })
              .where(eq(cogsRules.id, existingId));
          } else {
            toInsert.push({
              channelId,
              scope: "sku",
              matchValue: row.sku,
              country: row.country,
              minQty: row.minQty,
              costAmount: row.costAmount!,
              handlingFee: row.handlingFee,
              currency,
              source: "csv",
            });
          }
          imported++;
        }
        if (toInsert.length > 0) await tx.insert(cogsRules).values(toInsert);
      });
    }

    return {
      rows: results,
      total: results.length,
      valid: validRows.length,
      invalid: results.length - validRows.length,
      imported,
      dryRun: dto.dryRun,
    };
  }
}
