import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, isNull, lte, or, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { CogsScope, CostResolution } from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import {
  cogsRules,
  paymentFeeRules,
  shippingCostRules,
  taxConfig,
} from "../../database/schema/costs";
import { assertStoreInOrg } from "./store-access";

export interface CogsResolveInput {
  storeId: string;
  sku?: string | null;
  variantExternalId?: string | null;
  productExternalId?: string | null;
  quantity: number;
  country?: string | null;
  at?: Date;
}

export interface ShippingResolveInput {
  storeId: string;
  country?: string | null;
  quantity: number;
  weightGrams?: number | null;
  at?: Date;
}

export interface PaymentFeeResolveInput {
  storeId: string;
  gateway?: string | null;
  amount: string;
  at?: Date;
}

const num = (v: string | null | undefined): number => Number(v ?? 0);
const SCOPE_RANK: Record<CogsScope, number> = {
  sku: 3,
  variant: 2,
  product: 1,
  global: 0,
};

/** Bir sipariş satırı/işlem için geçerli maliyet kurallarını çözer (Faz 5 motoru bunu kullanır). */
@Injectable()
export class CostResolverService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Mağaza org-sahipliğini doğrular (yoksa 404). */
  assertStore(orgId: string, storeId: string): Promise<{ currency: string }> {
    return assertStoreInOrg(this.db, orgId, storeId);
  }

  /** Etkili tarih filtresi: from <= at <= to (null uçlar açık). */
  private effectiveAt(
    from: AnyPgColumn,
    to: AnyPgColumn,
    at: Date,
  ): SQL[] {
    return [
      or(isNull(from), lte(from, at))!,
      or(isNull(to), gte(to, at))!,
    ];
  }

  async resolveCogs(input: CogsResolveInput): Promise<CostResolution["cogs"]> {
    const at = input.at ?? new Date();
    const conds: SQL[] = [
      eq(cogsRules.storeId, input.storeId),
      lte(cogsRules.minQty, input.quantity),
      ...this.effectiveAt(cogsRules.effectiveFrom, cogsRules.effectiveTo, at),
    ];
    conds.push(
      input.country
        ? or(isNull(cogsRules.country), eq(cogsRules.country, input.country))!
        : isNull(cogsRules.country),
    );

    const rows = await this.db
      .select()
      .from(cogsRules)
      .where(and(...conds));

    // Kapsam'ın eşleşme değeri input ile uyuşan kuralları aday al.
    const applicable = rows.filter((r) => {
      switch (r.scope) {
        case "sku":
          return !!input.sku && r.matchValue === input.sku;
        case "variant":
          return (
            !!input.variantExternalId &&
            r.matchValue === input.variantExternalId
          );
        case "product":
          return (
            !!input.productExternalId &&
            r.matchValue === input.productExternalId
          );
        case "global":
          return true;
      }
    });
    if (applicable.length === 0) return null;

    // Öncelik: scope > ülke-özgül > yüksek minQty > en güncel effectiveFrom.
    applicable.sort((a, b) => {
      const s = SCOPE_RANK[b.scope] - SCOPE_RANK[a.scope];
      if (s !== 0) return s;
      const c = (b.country ? 1 : 0) - (a.country ? 1 : 0);
      if (c !== 0) return c;
      if (b.minQty !== a.minQty) return b.minQty - a.minQty;
      return (
        (b.effectiveFrom?.getTime() ?? 0) - (a.effectiveFrom?.getTime() ?? 0)
      );
    });

    const best = applicable[0]!;
    const unit = num(best.costAmount);
    const handling = num(best.handlingFee);
    const lineCogs = (unit + handling) * input.quantity;
    return {
      unitCost: unit.toFixed(4),
      handlingFee: handling.toFixed(4),
      lineCogs: lineCogs.toFixed(4),
      scope: best.scope,
      ruleId: best.id,
    };
  }

  async resolveShipping(
    input: ShippingResolveInput,
  ): Promise<CostResolution["shipping"]> {
    const at = input.at ?? new Date();
    const conds: SQL[] = [
      eq(shippingCostRules.storeId, input.storeId),
      ...this.effectiveAt(
        shippingCostRules.effectiveFrom,
        shippingCostRules.effectiveTo,
        at,
      ),
      or(isNull(shippingCostRules.minQty), lte(shippingCostRules.minQty, input.quantity))!,
      or(isNull(shippingCostRules.maxQty), gte(shippingCostRules.maxQty, input.quantity))!,
    ];
    conds.push(
      input.country
        ? or(
            isNull(shippingCostRules.country),
            eq(shippingCostRules.country, input.country),
          )!
        : isNull(shippingCostRules.country),
    );
    // Ağırlık verildiyse aralık kontrolü; verilmediyse yalnız ağırlıksız kurallar.
    if (input.weightGrams != null) {
      conds.push(
        or(
          isNull(shippingCostRules.minWeightGrams),
          lte(shippingCostRules.minWeightGrams, input.weightGrams),
        )!,
        or(
          isNull(shippingCostRules.maxWeightGrams),
          gte(shippingCostRules.maxWeightGrams, input.weightGrams),
        )!,
      );
    } else {
      conds.push(
        isNull(shippingCostRules.minWeightGrams),
        isNull(shippingCostRules.maxWeightGrams),
      );
    }

    const rows = await this.db
      .select()
      .from(shippingCostRules)
      .where(and(...conds));
    if (rows.length === 0) return null;

    rows.sort((a, b) => {
      const c = (b.country ? 1 : 0) - (a.country ? 1 : 0);
      if (c !== 0) return c;
      if ((b.minQty ?? 0) !== (a.minQty ?? 0)) {
        return (b.minQty ?? 0) - (a.minQty ?? 0);
      }
      return (
        (b.effectiveFrom?.getTime() ?? 0) - (a.effectiveFrom?.getTime() ?? 0)
      );
    });

    const best = rows[0]!;
    const cost = num(best.baseCost) + num(best.perItemCost) * input.quantity;
    return { cost: cost.toFixed(4), ruleId: best.id };
  }

  async resolvePaymentFee(
    input: PaymentFeeResolveInput,
  ): Promise<CostResolution["paymentFee"]> {
    const at = input.at ?? new Date();
    const conds: SQL[] = [
      eq(paymentFeeRules.storeId, input.storeId),
      ...this.effectiveAt(
        paymentFeeRules.effectiveFrom,
        paymentFeeRules.effectiveTo,
        at,
      ),
    ];
    conds.push(
      input.gateway
        ? or(
            isNull(paymentFeeRules.gateway),
            eq(paymentFeeRules.gateway, input.gateway),
          )!
        : isNull(paymentFeeRules.gateway),
    );

    const rows = await this.db
      .select()
      .from(paymentFeeRules)
      .where(and(...conds));
    if (rows.length === 0) return null;

    rows.sort((a, b) => {
      const g = (b.gateway ? 1 : 0) - (a.gateway ? 1 : 0);
      if (g !== 0) return g;
      return (
        (b.effectiveFrom?.getTime() ?? 0) - (a.effectiveFrom?.getTime() ?? 0)
      );
    });

    const best = rows[0]!;
    const fee = (num(input.amount) * num(best.percentage)) / 100 + num(best.fixedFee);
    return { fee: fee.toFixed(4), ruleId: best.id };
  }

  async resolveTax(storeId: string): Promise<CostResolution["tax"]> {
    const [row] = await this.db
      .select()
      .from(taxConfig)
      .where(eq(taxConfig.storeId, storeId))
      .limit(1);
    return {
      salesTaxBorne: row?.salesTaxBorne ?? false,
      incomeTaxRate: row?.incomeTaxRate ?? null,
    };
  }

  /** Tüm maliyet kalemlerini tek seferde çözer (debug endpoint + iç doğrulama). */
  async resolveAll(input: {
    storeId: string;
    sku?: string;
    variantExternalId?: string;
    productExternalId?: string;
    quantity: number;
    country?: string;
    weightGrams?: number;
    gateway?: string;
    amount?: string;
    at?: Date;
  }): Promise<CostResolution> {
    const [cogs, shipping, paymentFee, tax] = await Promise.all([
      this.resolveCogs(input),
      this.resolveShipping(input),
      input.amount != null
        ? this.resolvePaymentFee({
            storeId: input.storeId,
            gateway: input.gateway,
            amount: input.amount,
            at: input.at,
          })
        : Promise.resolve(null),
      this.resolveTax(input.storeId),
    ]);
    return { cogs, shipping, paymentFee, tax };
  }
}
