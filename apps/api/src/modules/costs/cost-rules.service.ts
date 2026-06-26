import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type {
  PaymentFeeRuleInput,
  PaymentFeeRuleSummary,
  ShippingRuleInput,
  ShippingRuleSummary,
  TaxConfigInput,
  TaxConfigSummary,
} from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import {
  paymentFeeRules,
  shippingCostRules,
  taxConfig,
} from "../../database/schema/costs";
import { assertStoreInOrg } from "./store-access";

type ShippingRow = typeof shippingCostRules.$inferSelect;
type PaymentRow = typeof paymentFeeRules.$inferSelect;
type TaxRow = typeof taxConfig.$inferSelect;

function toShipping(r: ShippingRow): ShippingRuleSummary {
  return {
    id: r.id,
    channelId: r.channelId,
    name: r.name,
    country: r.country,
    minQty: r.minQty,
    maxQty: r.maxQty,
    minWeightGrams: r.minWeightGrams,
    maxWeightGrams: r.maxWeightGrams,
    baseCost: r.baseCost,
    perItemCost: r.perItemCost,
    currency: r.currency,
    effectiveFrom: r.effectiveFrom?.toISOString() ?? null,
    effectiveTo: r.effectiveTo?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
  };
}

function toPayment(r: PaymentRow): PaymentFeeRuleSummary {
  return {
    id: r.id,
    channelId: r.channelId,
    gateway: r.gateway,
    percentage: r.percentage,
    fixedFee: r.fixedFee,
    currency: r.currency,
    effectiveFrom: r.effectiveFrom?.toISOString() ?? null,
    effectiveTo: r.effectiveTo?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
  };
}

function toTax(r: TaxRow): TaxConfigSummary {
  return {
    channelId: r.channelId,
    salesTaxBorne: r.salesTaxBorne,
    incomeTaxRate: r.incomeTaxRate,
    updatedAt: r.updatedAt.toISOString(),
  };
}

@Injectable()
export class CostRulesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ---- Kargo kuralları ----

  async listShipping(
    storeId: string,
    channelId: string,
  ): Promise<ShippingRuleSummary[]> {
    await assertStoreInOrg(this.db, storeId, channelId);
    const rows = await this.db
      .select()
      .from(shippingCostRules)
      .where(eq(shippingCostRules.channelId, channelId))
      .orderBy(shippingCostRules.createdAt);
    return rows.map(toShipping);
  }

  async createShipping(
    storeId: string,
    channelId: string,
    dto: ShippingRuleInput,
  ): Promise<ShippingRuleSummary> {
    const store = await assertStoreInOrg(this.db, storeId, channelId);
    const [row] = await this.db
      .insert(shippingCostRules)
      .values({
        channelId,
        name: dto.name,
        country: dto.country ?? null,
        minQty: dto.minQty ?? null,
        maxQty: dto.maxQty ?? null,
        minWeightGrams: dto.minWeightGrams ?? null,
        maxWeightGrams: dto.maxWeightGrams ?? null,
        baseCost: dto.baseCost,
        perItemCost: dto.perItemCost ?? null,
        currency: dto.currency ?? store.currency,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
      })
      .returning();
    return toShipping(row!);
  }

  /** Toplu kargo kuralı ekleme: tek INSERT ifadesi (atomik). */
  async createManyShipping(
    storeId: string,
    channelId: string,
    dtos: ShippingRuleInput[],
  ): Promise<ShippingRuleSummary[]> {
    const store = await assertStoreInOrg(this.db, storeId, channelId);
    const values: (typeof shippingCostRules.$inferInsert)[] = dtos.map(
      (dto) => ({
        channelId,
        name: dto.name,
        country: dto.country ?? null,
        minQty: dto.minQty ?? null,
        maxQty: dto.maxQty ?? null,
        minWeightGrams: dto.minWeightGrams ?? null,
        maxWeightGrams: dto.maxWeightGrams ?? null,
        baseCost: dto.baseCost,
        perItemCost: dto.perItemCost ?? null,
        currency: dto.currency ?? store.currency,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
      }),
    );
    const rows = await this.db
      .insert(shippingCostRules)
      .values(values)
      .returning();
    return rows.map(toShipping);
  }

  async updateShipping(
    storeId: string,
    channelId: string,
    id: string,
    dto: ShippingRuleInput,
  ): Promise<ShippingRuleSummary> {
    await assertStoreInOrg(this.db, storeId, channelId);
    const [row] = await this.db
      .update(shippingCostRules)
      .set({
        name: dto.name,
        country: dto.country ?? null,
        minQty: dto.minQty ?? null,
        maxQty: dto.maxQty ?? null,
        minWeightGrams: dto.minWeightGrams ?? null,
        maxWeightGrams: dto.maxWeightGrams ?? null,
        baseCost: dto.baseCost,
        perItemCost: dto.perItemCost ?? null,
        currency: dto.currency ?? null,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(shippingCostRules.id, id),
          eq(shippingCostRules.channelId, channelId),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException("Kargo kuralı bulunamadı");
    return toShipping(row);
  }

  async removeShipping(
    storeId: string,
    channelId: string,
    id: string,
  ): Promise<void> {
    await assertStoreInOrg(this.db, storeId, channelId);
    const deleted = await this.db
      .delete(shippingCostRules)
      .where(
        and(
          eq(shippingCostRules.id, id),
          eq(shippingCostRules.channelId, channelId),
        ),
      )
      .returning({ id: shippingCostRules.id });
    if (deleted.length === 0) {
      throw new NotFoundException("Kargo kuralı bulunamadı");
    }
  }

  // ---- Ödeme ücreti kuralları ----

  async listPaymentFees(
    storeId: string,
    channelId: string,
  ): Promise<PaymentFeeRuleSummary[]> {
    await assertStoreInOrg(this.db, storeId, channelId);
    const rows = await this.db
      .select()
      .from(paymentFeeRules)
      .where(eq(paymentFeeRules.channelId, channelId))
      .orderBy(paymentFeeRules.createdAt);
    return rows.map(toPayment);
  }

  async createPaymentFee(
    storeId: string,
    channelId: string,
    dto: PaymentFeeRuleInput,
  ): Promise<PaymentFeeRuleSummary> {
    const store = await assertStoreInOrg(this.db, storeId, channelId);
    const [row] = await this.db
      .insert(paymentFeeRules)
      .values({
        channelId,
        gateway: dto.gateway ?? null,
        percentage: dto.percentage,
        fixedFee: dto.fixedFee,
        currency: dto.currency ?? store.currency,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
      })
      .returning();
    return toPayment(row!);
  }

  async updatePaymentFee(
    storeId: string,
    channelId: string,
    id: string,
    dto: PaymentFeeRuleInput,
  ): Promise<PaymentFeeRuleSummary> {
    await assertStoreInOrg(this.db, storeId, channelId);
    const [row] = await this.db
      .update(paymentFeeRules)
      .set({
        gateway: dto.gateway ?? null,
        percentage: dto.percentage,
        fixedFee: dto.fixedFee,
        currency: dto.currency ?? null,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(paymentFeeRules.id, id), eq(paymentFeeRules.channelId, channelId)),
      )
      .returning();
    if (!row) throw new NotFoundException("Ödeme ücreti kuralı bulunamadı");
    return toPayment(row);
  }

  async removePaymentFee(
    storeId: string,
    channelId: string,
    id: string,
  ): Promise<void> {
    await assertStoreInOrg(this.db, storeId, channelId);
    const deleted = await this.db
      .delete(paymentFeeRules)
      .where(
        and(eq(paymentFeeRules.id, id), eq(paymentFeeRules.channelId, channelId)),
      )
      .returning({ id: paymentFeeRules.id });
    if (deleted.length === 0) {
      throw new NotFoundException("Ödeme ücreti kuralı bulunamadı");
    }
  }

  // ---- Vergi config (mağaza başına tek kayıt) ----

  async getTaxConfig(
    storeId: string,
    channelId: string,
  ): Promise<TaxConfigSummary> {
    await assertStoreInOrg(this.db, storeId, channelId);
    const [row] = await this.db
      .select()
      .from(taxConfig)
      .where(eq(taxConfig.channelId, channelId))
      .limit(1);
    if (row) return toTax(row);
    // Varsayılan (henüz config yok).
    return {
      channelId,
      salesTaxBorne: false,
      incomeTaxRate: null,
      updatedAt: new Date(0).toISOString(),
    };
  }

  async upsertTaxConfig(
    storeId: string,
    channelId: string,
    dto: TaxConfigInput,
  ): Promise<TaxConfigSummary> {
    await assertStoreInOrg(this.db, storeId, channelId);
    const now = new Date();
    const [row] = await this.db
      .insert(taxConfig)
      .values({
        channelId,
        salesTaxBorne: dto.salesTaxBorne,
        incomeTaxRate: dto.incomeTaxRate ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: taxConfig.channelId,
        set: {
          salesTaxBorne: dto.salesTaxBorne,
          incomeTaxRate: dto.incomeTaxRate ?? null,
          updatedAt: now,
        },
      })
      .returning();
    return toTax(row!);
  }
}
