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
    storeId: r.storeId,
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
    storeId: r.storeId,
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
    storeId: r.storeId,
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
    orgId: string,
    storeId: string,
  ): Promise<ShippingRuleSummary[]> {
    await assertStoreInOrg(this.db, orgId, storeId);
    const rows = await this.db
      .select()
      .from(shippingCostRules)
      .where(eq(shippingCostRules.storeId, storeId))
      .orderBy(shippingCostRules.createdAt);
    return rows.map(toShipping);
  }

  async createShipping(
    orgId: string,
    storeId: string,
    dto: ShippingRuleInput,
  ): Promise<ShippingRuleSummary> {
    const store = await assertStoreInOrg(this.db, orgId, storeId);
    const [row] = await this.db
      .insert(shippingCostRules)
      .values({
        storeId,
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
    orgId: string,
    storeId: string,
    dtos: ShippingRuleInput[],
  ): Promise<ShippingRuleSummary[]> {
    const store = await assertStoreInOrg(this.db, orgId, storeId);
    const values: (typeof shippingCostRules.$inferInsert)[] = dtos.map(
      (dto) => ({
        storeId,
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
    orgId: string,
    storeId: string,
    id: string,
    dto: ShippingRuleInput,
  ): Promise<ShippingRuleSummary> {
    await assertStoreInOrg(this.db, orgId, storeId);
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
          eq(shippingCostRules.storeId, storeId),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException("Kargo kuralı bulunamadı");
    return toShipping(row);
  }

  async removeShipping(
    orgId: string,
    storeId: string,
    id: string,
  ): Promise<void> {
    await assertStoreInOrg(this.db, orgId, storeId);
    const deleted = await this.db
      .delete(shippingCostRules)
      .where(
        and(
          eq(shippingCostRules.id, id),
          eq(shippingCostRules.storeId, storeId),
        ),
      )
      .returning({ id: shippingCostRules.id });
    if (deleted.length === 0) {
      throw new NotFoundException("Kargo kuralı bulunamadı");
    }
  }

  // ---- Ödeme ücreti kuralları ----

  async listPaymentFees(
    orgId: string,
    storeId: string,
  ): Promise<PaymentFeeRuleSummary[]> {
    await assertStoreInOrg(this.db, orgId, storeId);
    const rows = await this.db
      .select()
      .from(paymentFeeRules)
      .where(eq(paymentFeeRules.storeId, storeId))
      .orderBy(paymentFeeRules.createdAt);
    return rows.map(toPayment);
  }

  async createPaymentFee(
    orgId: string,
    storeId: string,
    dto: PaymentFeeRuleInput,
  ): Promise<PaymentFeeRuleSummary> {
    const store = await assertStoreInOrg(this.db, orgId, storeId);
    const [row] = await this.db
      .insert(paymentFeeRules)
      .values({
        storeId,
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
    orgId: string,
    storeId: string,
    id: string,
    dto: PaymentFeeRuleInput,
  ): Promise<PaymentFeeRuleSummary> {
    await assertStoreInOrg(this.db, orgId, storeId);
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
        and(eq(paymentFeeRules.id, id), eq(paymentFeeRules.storeId, storeId)),
      )
      .returning();
    if (!row) throw new NotFoundException("Ödeme ücreti kuralı bulunamadı");
    return toPayment(row);
  }

  async removePaymentFee(
    orgId: string,
    storeId: string,
    id: string,
  ): Promise<void> {
    await assertStoreInOrg(this.db, orgId, storeId);
    const deleted = await this.db
      .delete(paymentFeeRules)
      .where(
        and(eq(paymentFeeRules.id, id), eq(paymentFeeRules.storeId, storeId)),
      )
      .returning({ id: paymentFeeRules.id });
    if (deleted.length === 0) {
      throw new NotFoundException("Ödeme ücreti kuralı bulunamadı");
    }
  }

  // ---- Vergi config (mağaza başına tek kayıt) ----

  async getTaxConfig(
    orgId: string,
    storeId: string,
  ): Promise<TaxConfigSummary> {
    await assertStoreInOrg(this.db, orgId, storeId);
    const [row] = await this.db
      .select()
      .from(taxConfig)
      .where(eq(taxConfig.storeId, storeId))
      .limit(1);
    if (row) return toTax(row);
    // Varsayılan (henüz config yok).
    return {
      storeId,
      salesTaxBorne: false,
      incomeTaxRate: null,
      updatedAt: new Date(0).toISOString(),
    };
  }

  async upsertTaxConfig(
    orgId: string,
    storeId: string,
    dto: TaxConfigInput,
  ): Promise<TaxConfigSummary> {
    await assertStoreInOrg(this.db, orgId, storeId);
    const now = new Date();
    const [row] = await this.db
      .insert(taxConfig)
      .values({
        storeId,
        salesTaxBorne: dto.salesTaxBorne,
        incomeTaxRate: dto.incomeTaxRate ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: taxConfig.storeId,
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
