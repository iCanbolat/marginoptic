import { Inject, Injectable } from "@nestjs/common";
import { and, asc, between, eq, inArray } from "drizzle-orm";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import {
  orderLineItems,
  orderTransactions,
  orders,
  refunds,
} from "../../database/schema/sales";
import { CostResolverService } from "../costs/cost-resolver.service";
import { orderNetContribution } from "./contribution";
import { FxService } from "./fx.service";

const num = (v: string | null | undefined): number => Number(v ?? 0);

/** "YYYY-MM-DD" iş günü (sipariş işlenme tarihinin UTC günü). */
function businessDate(o: {
  processedAt: Date | null;
  shopifyCreatedAt: Date | null;
  createdAt: Date;
}): string {
  return (o.processedAt ?? o.shopifyCreatedAt ?? o.createdAt)
    .toISOString()
    .slice(0, 10);
}

export interface LineContribution {
  productExternalId: string | null;
  title: string | null;
  units: number;
  revenue: number;
  discount: number;
  cogs: number;
  /** Ürün-seviyesi katkı: revenue − discount − cogs. */
  net: number;
}

export interface OrderContribution {
  orderId: string;
  date: string;
  grossSales: number;
  discounts: number;
  refunds: number;
  cogs: number;
  shippingCost: number;
  paymentFees: number;
  taxBorne: number;
  net: number;
  units: number;
  lines: LineContribution[];
}

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

/**
 * Faz 5 — Sipariş-bazında net katkıyı çözer.
 * Satış verisini okur, COGS/kargo/ödeme ücreti/vergi kurallarını `CostResolver` ile,
 * çoklu para birimini `FxService` ile çözer; saf {@link orderNetContribution} formülünü
 * uygular. Gün+mağaza rollup'ı bu çıktıyı toplar.
 */
@Injectable()
export class ContributionService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly resolver: CostResolverService,
    private readonly fx: FxService,
  ) {}

  /**
   * Mağazanın (test olmayan) siparişleri için katkı listesi.
   * `range` verilmezse tüm siparişler (tam rollup); verilirse processedAt o aralıkta.
   */
  async computeStoreContributions(
    channelId: string,
    storeCurrency: string,
    range?: DateRange,
  ): Promise<OrderContribution[]> {
    const conds = [eq(orders.channelId, channelId), eq(orders.test, false)];
    if (range) {
      conds.push(
        between(
          orders.processedAt,
          new Date(`${range.from}T00:00:00.000Z`),
          new Date(`${range.to}T23:59:59.999Z`),
        ),
      );
    }
    const orderRows = await this.db
      .select()
      .from(orders)
      .where(and(...conds))
      .orderBy(asc(orders.processedAt));
    if (orderRows.length === 0) return [];

    const orderIds = orderRows.map((o) => o.id);
    const [lineRows, txnRows, refundRows] = await Promise.all([
      this.db
        .select()
        .from(orderLineItems)
        .where(inArray(orderLineItems.orderId, orderIds)),
      this.db
        .select()
        .from(orderTransactions)
        .where(inArray(orderTransactions.orderId, orderIds)),
      this.db
        .select()
        .from(refunds)
        .where(inArray(refunds.orderId, orderIds)),
    ]);

    const linesByOrder = groupBy(lineRows, (r) => r.orderId);
    const txnsByOrder = groupBy(txnRows, (r) => r.orderId);
    const refundsByOrder = groupBy(refundRows, (r) => r.orderId);

    const tax = await this.resolver.resolveTax(channelId);

    const out: OrderContribution[] = [];
    for (const o of orderRows) {
      const date = businessDate(o);
      const at = o.processedAt ?? o.shopifyCreatedAt ?? o.createdAt;
      const orderCurrency = o.currency ?? storeCurrency;
      const fxConvert = (amount: number) =>
        this.fx.convert(amount, orderCurrency, storeCurrency, date);

      // ---- satırlar: gelir + COGS (ürün-seviyesi katkı) ----
      const lines: LineContribution[] = [];
      let grossSales = 0;
      let units = 0;
      let cogsTotal = 0;
      for (const li of linesByOrder.get(o.id) ?? []) {
        const qty = li.quantity ?? 0;
        const grossLine = num(li.price) * qty;
        const revenue = await fxConvert(grossLine);
        const discount = await fxConvert(num(li.discountAmount));
        const cogsRes = await this.resolver.resolveCogs({
          channelId,
          sku: li.sku,
          variantExternalId: li.variantExternalId,
          productExternalId: li.productExternalId,
          quantity: qty || 1,
          country: null,
          at,
        });
        const cogs = cogsRes ? num(cogsRes.lineCogs) : 0;
        grossSales += revenue;
        units += qty;
        cogsTotal += cogs;
        lines.push({
          productExternalId: li.productExternalId,
          title: li.title,
          units: qty,
          revenue,
          discount,
          cogs,
          net: revenue - discount - cogs,
        });
      }

      // ---- sipariş-seviyesi kalemler ----
      const discounts = await fxConvert(num(o.totalDiscounts));
      const refundTotal = await sumAsync(
        refundsByOrder.get(o.id) ?? [],
        (r) => fxConvert(num(r.amount)),
      );

      const shippingRes = await this.resolver.resolveShipping({
        channelId,
        country: null,
        quantity: units || 1,
        weightGrams: null,
        at,
      });
      const shippingCost = shippingRes ? num(shippingRes.cost) : 0;

      const paymentFees = await this.resolvePaymentFees(
        channelId,
        txnsByOrder.get(o.id) ?? [],
        o.totalPrice,
        orderCurrency,
        storeCurrency,
        date,
        at,
      );

      const taxBorne = tax.salesTaxBorne ? await fxConvert(num(o.totalTax)) : 0;

      const net = orderNetContribution({
        grossSales,
        discounts,
        refunds: refundTotal,
        cogs: cogsTotal,
        shippingCost,
        paymentFees,
        taxBorne,
      });

      out.push({
        orderId: o.id,
        date,
        grossSales,
        discounts,
        refunds: refundTotal,
        cogs: cogsTotal,
        shippingCost,
        paymentFees,
        taxBorne,
        net,
        units,
        lines,
      });
    }
    return out;
  }

  /** Gerçek transaction fee'leri varsa onları, yoksa payment_fee_rules ile çözer. */
  private async resolvePaymentFees(
    channelId: string,
    txns: (typeof orderTransactions.$inferSelect)[],
    totalPrice: string | null,
    orderCurrency: string,
    storeCurrency: string,
    date: string,
    at: Date,
  ): Promise<number> {
    const withFee = txns.filter((t) => t.fee != null);
    if (withFee.length > 0) {
      return sumAsync(withFee, (t) =>
        this.fx.convert(
          num(t.fee),
          t.currency ?? orderCurrency,
          storeCurrency,
          date,
        ),
      );
    }
    // Gerçek ücret yok → kural ile çöz (tutar mağaza para biriminde).
    const amountStore = await this.fx.convert(
      num(totalPrice),
      orderCurrency,
      storeCurrency,
      date,
    );
    const res = await this.resolver.resolvePaymentFee({
      channelId,
      gateway: txns[0]?.gateway ?? null,
      amount: amountStore.toFixed(4),
      at,
    });
    return res ? num(res.fee) : 0;
  }
}

function groupBy<T, K>(rows: T[], key: (r: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
}

async function sumAsync<T>(
  rows: T[],
  fn: (r: T) => Promise<number>,
): Promise<number> {
  let total = 0;
  for (const r of rows) total += await fn(r);
  return total;
}
