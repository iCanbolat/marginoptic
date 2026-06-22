import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Queue } from "bullmq";
import { and, asc, between, desc, eq, sql } from "drizzle-orm";
import type { Redis } from "ioredis";
import type {
  DailyStoreMetric,
  MetricsTotals,
  ProductProfitRow,
  StoreMetricsSummary,
} from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { adSpend } from "../../database/schema/ads";
import { expenseAllocations } from "../../database/schema/costs";
import {
  dailyStoreMetrics,
  productProfitDaily,
} from "../../database/schema/metrics";
import { stores } from "../../database/schema/stores";
import { REDIS } from "../../redis/redis.module";
import { assertStoreInOrg } from "../costs/store-access";
import { ContributionService, type DateRange } from "./contribution.service";
import {
  dailyNetProfit,
  emptyDaily,
  profitMargin,
  round4,
  type DailyMetricsAccumulator,
} from "./contribution";
import { QUEUE_METRICS_ROLLUP, type MetricsRollupJob } from "./profit.constants";

const f4 = (n: number): string => round4(n).toFixed(4);
const num = (v: string | null | undefined): number => Number(v ?? 0);
const CACHE_TTL_SECONDS = 300;

interface ProductAccumulator {
  date: string;
  productExternalId: string;
  title: string | null;
  units: number;
  revenue: number;
  cogs: number;
  attributedAdSpend: number;
  net: number;
}

/**
 * Faz 5 — Gün+mağaza rollup'ı yazar/okur.
 * `metrics-rollup` kuyruğu `rollupStore`'u çağırır; sipariş katkıları + dağıtılmış
 * özel giderler `daily_store_metrics` ve `product_profit_daily`'ye idempotent yazılır.
 * Okumalar Redis'te `metrics:{store}:{from}:{to}` anahtarıyla cache'lenir; rollup
 * yazınca mağazanın anahtarları invalidate edilir.
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly contributions: ContributionService,
    @InjectQueue(QUEUE_METRICS_ROLLUP)
    private readonly queue: Queue<MetricsRollupJob>,
  ) {}

  // ---- yazma (rollup) ----

  /**
   * Bir mağazanın metriklerini yeniden hesaplar.
   * `range` verilmezse tam (mağazanın tüm tarihleri), verilirse yalnız o aralık.
   */
  async rollupStore(storeId: string, range?: DateRange): Promise<number> {
    const [store] = await this.db
      .select({
        currency: stores.currency,
        organizationId: stores.organizationId,
      })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);
    if (!store) return 0;
    const currency = store.currency;

    const contributions = await this.contributions.computeStoreContributions(
      storeId,
      currency,
      range,
    );

    // Gün toplayıcıları (siparişlerden).
    const daily = new Map<string, DailyMetricsAccumulator>();
    const bucket = (date: string): DailyMetricsAccumulator => {
      let b = daily.get(date);
      if (!b) {
        b = emptyDaily();
        daily.set(date, b);
      }
      return b;
    };
    const products = new Map<string, ProductAccumulator>();

    for (const o of contributions) {
      const b = bucket(o.date);
      b.revenue += o.grossSales;
      b.discounts += o.discounts;
      b.refunds += o.refunds;
      b.cogs += o.cogs;
      b.shippingCost += o.shippingCost;
      b.paymentFees += o.paymentFees;
      b.taxes += o.taxBorne;
      b.ordersCount += 1;
      b.units += o.units;

      for (const li of o.lines) {
        const pid = li.productExternalId ?? "unknown";
        const key = `${o.date}|${pid}`;
        let p = products.get(key);
        if (!p) {
          p = {
            date: o.date,
            productExternalId: pid,
            title: li.title,
            units: 0,
            revenue: 0,
            cogs: 0,
            attributedAdSpend: 0,
            net: 0,
          };
          products.set(key, p);
        }
        p.units += li.units;
        p.revenue += li.revenue;
        p.cogs += li.cogs;
        p.net += li.net;
        if (!p.title && li.title) p.title = li.title;
      }
    }

    // Dağıtılmış özel giderler (sipariş olmayan günlerde de gün oluşturur).
    const allocConds = [eq(expenseAllocations.storeId, storeId)];
    if (range) {
      allocConds.push(between(expenseAllocations.date, range.from, range.to));
    }
    const allocRows = await this.db
      .select({
        date: expenseAllocations.date,
        amount: expenseAllocations.amount,
      })
      .from(expenseAllocations)
      .where(and(...allocConds));
    for (const a of allocRows) {
      bucket(a.date).customExpenses += num(a.amount);
    }

    // Reklam harcaması (blended): campaign seviyesi gün toplamı → gün+mağaza ad_spend.
    const adConds = [
      eq(adSpend.storeId, storeId),
      eq(adSpend.level, "campaign"),
    ];
    if (range) {
      adConds.push(between(adSpend.date, range.from, range.to));
    }
    const adRows = await this.db
      .select({
        date: adSpend.date,
        spend: sql<string>`sum(${adSpend.spend})`,
      })
      .from(adSpend)
      .where(and(...adConds))
      .groupBy(adSpend.date);
    for (const a of adRows) {
      bucket(a.date).adSpend += num(a.spend);
    }

    // Ürün-seviyesi reklam atfı (ciro-payı): günün reklam harcamasını o günün
    // ürünlerine ciro oranıyla dağıt; ürün net kârından düş.
    for (const p of products.values()) {
      const day = daily.get(p.date);
      if (!day || day.adSpend <= 0 || day.revenue <= 0) continue;
      p.attributedAdSpend = day.adSpend * (p.revenue / day.revenue);
      p.net -= p.attributedAdSpend;
    }

    // Yaz (idempotent: aralığı/mağazayı temizle, yeniden ekle).
    await this.db.transaction(async (tx) => {
      if (range) {
        await tx
          .delete(dailyStoreMetrics)
          .where(
            and(
              eq(dailyStoreMetrics.storeId, storeId),
              between(dailyStoreMetrics.date, range.from, range.to),
            ),
          );
        await tx
          .delete(productProfitDaily)
          .where(
            and(
              eq(productProfitDaily.storeId, storeId),
              between(productProfitDaily.date, range.from, range.to),
            ),
          );
      } else {
        await tx
          .delete(dailyStoreMetrics)
          .where(eq(dailyStoreMetrics.storeId, storeId));
        await tx
          .delete(productProfitDaily)
          .where(eq(productProfitDaily.storeId, storeId));
      }

      if (daily.size > 0) {
        await tx.insert(dailyStoreMetrics).values(
          [...daily.entries()].map(([date, b]) => ({
            storeId,
            date,
            currency,
            revenue: f4(b.revenue),
            discounts: f4(b.discounts),
            refunds: f4(b.refunds),
            cogs: f4(b.cogs),
            shippingCost: f4(b.shippingCost),
            paymentFees: f4(b.paymentFees),
            taxes: f4(b.taxes),
            adSpend: f4(b.adSpend),
            customExpenses: f4(b.customExpenses),
            netProfit: f4(dailyNetProfit(b)),
            ordersCount: b.ordersCount,
            units: b.units,
          })),
        );
      }
      if (products.size > 0) {
        await tx.insert(productProfitDaily).values(
          [...products.values()].map((p) => ({
            storeId,
            date: p.date,
            productExternalId: p.productExternalId,
            title: p.title,
            currency,
            units: p.units,
            revenue: f4(p.revenue),
            cogs: f4(p.cogs),
            attributedAdSpend: f4(p.attributedAdSpend),
            netProfit: f4(p.net),
          })),
        );
      }
    });

    await this.invalidateStore(storeId, store.organizationId);
    this.logger.log(
      `Rollup mağaza=${storeId}${range ? ` ${range.from}→${range.to}` : " (tam)"}: ${daily.size} gün, ${products.size} ürün-gün`,
    );
    return daily.size;
  }

  /** Tüm aktif mağazaları tam yeniden hesaplar (gece scheduler). */
  async rollupAllActive(): Promise<number> {
    const active = await this.db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.status, "active"));
    let total = 0;
    for (const s of active) total += await this.rollupStore(s.id);
    return total;
  }

  /** Rollup işini kuyruğa alır (manuel tetikleme / artımlı). */
  async enqueueRollup(job: MetricsRollupJob): Promise<void> {
    await this.queue.add("rollup", job);
  }

  /** Manuel yeniden hesaplama: org-sahipliği doğrula, tam rollup kuyruğa al. */
  async requestRecompute(orgId: string, storeId: string): Promise<void> {
    await assertStoreInOrg(this.db, orgId, storeId);
    await this.enqueueRollup({ storeId });
  }

  // ---- okuma (cache'li) ----

  async getStoreMetrics(
    orgId: string,
    storeId: string,
    from: string,
    to: string,
  ): Promise<StoreMetricsSummary> {
    await assertStoreInOrg(this.db, orgId, storeId);

    const cacheKey = `metrics:${storeId}:${from}:${to}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as StoreMetricsSummary;

    const rows = await this.db
      .select()
      .from(dailyStoreMetrics)
      .where(
        and(
          eq(dailyStoreMetrics.storeId, storeId),
          between(dailyStoreMetrics.date, from, to),
        ),
      )
      .orderBy(asc(dailyStoreMetrics.date));

    const days: DailyStoreMetric[] = rows.map((r) => ({
      date: r.date,
      currency: r.currency,
      revenue: r.revenue,
      discounts: r.discounts,
      refunds: r.refunds,
      cogs: r.cogs,
      shippingCost: r.shippingCost,
      paymentFees: r.paymentFees,
      taxes: r.taxes,
      adSpend: r.adSpend,
      customExpenses: r.customExpenses,
      netProfit: r.netProfit,
      ordersCount: r.ordersCount,
      units: r.units,
    }));

    const currency = days[0]?.currency ?? "USD";
    const totals = computeTotals(days);
    const summary: StoreMetricsSummary = {
      storeId,
      currency,
      from,
      to,
      days,
      totals,
    };
    await this.redis.set(
      cacheKey,
      JSON.stringify(summary),
      "EX",
      CACHE_TTL_SECONDS,
    );
    return summary;
  }

  /** Ürün kârlılık sıralaması (net kâra göre azalan). */
  async getProductRanking(
    orgId: string,
    storeId: string,
    from: string,
    to: string,
    limit = 20,
  ): Promise<ProductProfitRow[]> {
    await assertStoreInOrg(this.db, orgId, storeId);

    const rows = await this.db
      .select({
        productExternalId: productProfitDaily.productExternalId,
        title: sql<string | null>`max(${productProfitDaily.title})`,
        currency: sql<string>`max(${productProfitDaily.currency})`,
        units: sql<number>`sum(${productProfitDaily.units})::int`,
        revenue: sql<string>`sum(${productProfitDaily.revenue})`,
        cogs: sql<string>`sum(${productProfitDaily.cogs})`,
        attributedAdSpend: sql<string>`sum(${productProfitDaily.attributedAdSpend})`,
        netProfit: sql<string>`sum(${productProfitDaily.netProfit})`,
      })
      .from(productProfitDaily)
      .where(
        and(
          eq(productProfitDaily.storeId, storeId),
          between(productProfitDaily.date, from, to),
        ),
      )
      .groupBy(productProfitDaily.productExternalId)
      .orderBy(desc(sql`sum(${productProfitDaily.netProfit})`))
      .limit(limit);

    return rows.map((r) => ({
      productExternalId: r.productExternalId,
      title: r.title,
      currency: r.currency,
      units: r.units,
      revenue: r.revenue,
      cogs: r.cogs,
      attributedAdSpend: r.attributedAdSpend,
      netProfit: r.netProfit,
    }));
  }

  /**
   * Rollup sonrası ilgili cache anahtarlarını siler: mağaza metrikleri
   * (`metrics:{store}:*`) + org analitik agregaları (`analytics:{org}:*`).
   */
  private async invalidateStore(
    storeId: string,
    orgId?: string,
  ): Promise<void> {
    const patterns = [`metrics:${storeId}:*`];
    if (orgId) patterns.push(`analytics:${orgId}:*`);
    for (const pattern of patterns) {
      let cursor = "0";
      do {
        const [next, keys] = await this.redis.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100,
        );
        cursor = next;
        if (keys.length > 0) await this.redis.del(...keys);
      } while (cursor !== "0");
    }
  }
}

function computeTotals(days: DailyStoreMetric[]): MetricsTotals {
  const acc = emptyDaily();
  for (const d of days) {
    acc.revenue += num(d.revenue);
    acc.discounts += num(d.discounts);
    acc.refunds += num(d.refunds);
    acc.cogs += num(d.cogs);
    acc.shippingCost += num(d.shippingCost);
    acc.paymentFees += num(d.paymentFees);
    acc.taxes += num(d.taxes);
    acc.adSpend += num(d.adSpend);
    acc.customExpenses += num(d.customExpenses);
    acc.ordersCount += d.ordersCount;
    acc.units += d.units;
  }
  const netProfit = dailyNetProfit(acc);
  const ratio = (n: number) =>
    acc.adSpend > 0 ? round4(n / acc.adSpend) : null;
  return {
    revenue: f4(acc.revenue),
    discounts: f4(acc.discounts),
    refunds: f4(acc.refunds),
    cogs: f4(acc.cogs),
    shippingCost: f4(acc.shippingCost),
    paymentFees: f4(acc.paymentFees),
    taxes: f4(acc.taxes),
    adSpend: f4(acc.adSpend),
    customExpenses: f4(acc.customExpenses),
    netProfit: f4(netProfit),
    ordersCount: acc.ordersCount,
    units: acc.units,
    margin: profitMargin(netProfit, acc.revenue),
    roas: ratio(acc.revenue),
    poas: ratio(netProfit),
  };
}
