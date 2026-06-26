import { Inject, Injectable } from "@nestjs/common";
import { and, asc, between, desc, eq, inArray, sql } from "drizzle-orm";
import type { Redis } from "ioredis";
import type {
  AdLevel,
  AdsPerformanceResponse,
  AnalyticsFilter,
  DailyStoreMetric,
  PnlLine,
  PnlResponse,
  ProductRankingResponse,
  ProfitSummaryResponse,
  StoreComparisonResponse,
  TimeseriesResponse,
} from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { dailyStoreMetrics, productProfitDaily } from "../../database/schema/metrics";
import { REDIS } from "../../redis/redis.module";
import { AdsQueryService } from "../ads/ads-query.service";
import {
  dailyNetProfit,
  emptyDaily,
  profitMargin,
} from "../profit/contribution";
import {
  accumulate,
  addRow,
  buildTotals,
  f4,
  num,
  pctChange,
  previousRange,
  type RawMetricRow,
} from "./analytics-math";
import { resolveStoreChannels } from "./store-channels";

const CACHE_TTL = 300;

/** Bir gün/mağaza satırı (channelId + date + ham metrikler). */
type Row = RawMetricRow & { channelId: string; date: string };

/** Org-kapsamlı, çok-mağaza analitik okumaları (Redis cache'li). */
@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly ads: AdsQueryService,
  ) {}

  // ---- Kâr özeti (+ opsiyonel önceki dönem karşılaştırması) ----

  async profitSummary(
    storeId: string,
    filter: AnalyticsFilter,
  ): Promise<ProfitSummaryResponse> {
    return this.cached(storeId, "profit-summary", filter, async () => {
      const channels = await resolveStoreChannels(this.db, storeId, filter.storeIds);
      const ids = channels.map((s) => s.id);
      const currency = channels[0]?.currency ?? "USD";
      const totals = buildTotals(await this.loadTotals(ids, filter.from, filter.to));

      let comparison: ProfitSummaryResponse["comparison"] = null;
      if (filter.compare) {
        const prev = previousRange(filter.from, filter.to);
        const prevAcc = await this.loadTotals(ids, prev.from, prev.to);
        const prevTotals = buildTotals(prevAcc);
        comparison = {
          from: prev.from,
          to: prev.to,
          totals: prevTotals,
          deltas: {
            revenue: pctChange(num(totals.revenue), num(prevTotals.revenue)),
            netProfit: pctChange(num(totals.netProfit), num(prevTotals.netProfit)),
            ordersCount: pctChange(totals.ordersCount, prevTotals.ordersCount),
            adSpend: pctChange(num(totals.adSpend), num(prevTotals.adSpend)),
            margin:
              totals.margin != null && prevTotals.margin != null
                ? Math.round((totals.margin - prevTotals.margin) * 100) / 100
                : null,
          },
        };
      }

      return {
        from: filter.from,
        to: filter.to,
        currency,
        storeIds: ids,
        totals,
        comparison,
      };
    });
  }

  // ---- P&L (gelir tablosu satırları) ----

  async pnl(storeId: string, filter: AnalyticsFilter): Promise<PnlResponse> {
    return this.cached(storeId, "pnl", filter, async () => {
      const channels = await resolveStoreChannels(this.db, storeId, filter.storeIds);
      const ids = channels.map((s) => s.id);
      const currency = channels[0]?.currency ?? "USD";
      const acc = await this.loadTotals(ids, filter.from, filter.to);
      const netProfit = dailyNetProfit(acc);
      const revenue = acc.revenue;
      const pct = (n: number): number | null =>
        revenue === 0 ? null : Math.round((n / revenue) * 1e4) / 100;

      const cost = (key: string, label: string, amount: number): PnlLine => ({
        key,
        label,
        amount: f4(amount),
        pctOfRevenue: pct(amount),
        isCost: true,
      });

      const lines: PnlLine[] = [
        { key: "revenue", label: "Brüt Satış", amount: f4(revenue), pctOfRevenue: pct(revenue), isCost: false },
        cost("discounts", "İndirimler", acc.discounts),
        cost("refunds", "İadeler", acc.refunds),
        cost("cogs", "COGS", acc.cogs),
        cost("shippingCost", "Kargo", acc.shippingCost),
        cost("paymentFees", "Ödeme Ücretleri", acc.paymentFees),
        cost("taxes", "Vergiler", acc.taxes),
        cost("adSpend", "Reklam Harcaması", acc.adSpend),
        cost("customExpenses", "Özel Giderler", acc.customExpenses),
        { key: "netProfit", label: "Net Kâr", amount: f4(netProfit), pctOfRevenue: pct(netProfit), isCost: false },
      ];

      return {
        from: filter.from,
        to: filter.to,
        currency,
        storeIds: ids,
        lines,
        netProfit: f4(netProfit),
        margin: profitMargin(netProfit, revenue),
      };
    });
  }

  // ---- Zaman serisi (gün başına, mağazalar toplanmış) ----

  async timeseries(
    storeId: string,
    filter: AnalyticsFilter,
  ): Promise<TimeseriesResponse> {
    return this.cached(storeId, "timeseries", filter, async () => {
      const channels = await resolveStoreChannels(this.db, storeId, filter.storeIds);
      const ids = channels.map((s) => s.id);
      const currency = channels[0]?.currency ?? "USD";
      const rows = await this.fetchRows(ids, filter.from, filter.to);

      const byDay = new Map<string, ReturnType<typeof emptyDaily>>();
      for (const r of rows) {
        let acc = byDay.get(r.date);
        if (!acc) {
          acc = emptyDaily();
          byDay.set(r.date, acc);
        }
        addRow(acc, r);
      }

      const points: DailyStoreMetric[] = [...byDay.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, acc]) => ({
          date,
          currency,
          revenue: f4(acc.revenue),
          discounts: f4(acc.discounts),
          refunds: f4(acc.refunds),
          cogs: f4(acc.cogs),
          shippingCost: f4(acc.shippingCost),
          paymentFees: f4(acc.paymentFees),
          taxes: f4(acc.taxes),
          adSpend: f4(acc.adSpend),
          customExpenses: f4(acc.customExpenses),
          netProfit: f4(dailyNetProfit(acc)),
          ordersCount: acc.ordersCount,
          units: acc.units,
        }));

      return { from: filter.from, to: filter.to, currency, storeIds: ids, points };
    });
  }

  // ---- Çok-mağaza karşılaştırma ----

  async storeComparison(
    storeId: string,
    filter: AnalyticsFilter,
  ): Promise<StoreComparisonResponse> {
    return this.cached(storeId, "store-comparison", filter, async () => {
      const channels = await resolveStoreChannels(this.db, storeId, filter.storeIds);
      const ids = channels.map((s) => s.id);
      const rows = await this.fetchRows(ids, filter.from, filter.to);

      const byStore = new Map<string, ReturnType<typeof emptyDaily>>();
      for (const r of rows) {
        let acc = byStore.get(r.channelId);
        if (!acc) {
          acc = emptyDaily();
          byStore.set(r.channelId, acc);
        }
        addRow(acc, r);
      }

      return {
        from: filter.from,
        to: filter.to,
        rows: channels.map((s) => ({
          channelId: s.id,
          storeName: s.name,
          currency: s.currency,
          totals: buildTotals(byStore.get(s.id) ?? emptyDaily()),
        })),
      };
    });
  }

  // ---- Ürün kârlılık sıralaması (org genelinde) ----

  async productRanking(
    storeId: string,
    filter: AnalyticsFilter,
    limit: number,
  ): Promise<ProductRankingResponse> {
    return this.cached(storeId, `products:${limit}`, filter, async () => {
      const channels = await resolveStoreChannels(this.db, storeId, filter.storeIds);
      const ids = channels.map((s) => s.id);
      const nameById = new Map(channels.map((s) => [s.id, s.name]));
      if (ids.length === 0) {
        return { from: filter.from, to: filter.to, storeIds: ids, rows: [] };
      }

      const rows = await this.db
        .select({
          channelId: productProfitDaily.channelId,
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
            inArray(productProfitDaily.channelId, ids),
            between(productProfitDaily.date, filter.from, filter.to),
          ),
        )
        .groupBy(productProfitDaily.channelId, productProfitDaily.productExternalId)
        .orderBy(desc(sql`sum(${productProfitDaily.netProfit})`))
        .limit(limit);

      // Opsiyonel önceki dönem: ürün başına net kâr trend rozeti için.
      const prevNetById = filter.compare
        ? await this.previousProductNet(ids, filter.from, filter.to)
        : null;

      return {
        from: filter.from,
        to: filter.to,
        storeIds: ids,
        rows: rows.map((r) => {
          const prevNet = prevNetById?.get(
            `${r.channelId}:${r.productExternalId}`,
          );
          const netProfitDelta =
            prevNet != null ? pctChange(num(r.netProfit), prevNet) : null;
          return {
            channelId: r.channelId,
            storeName: nameById.get(r.channelId) ?? "—",
            productExternalId: r.productExternalId,
            title: r.title,
            currency: r.currency,
            units: r.units,
            revenue: r.revenue,
            cogs: r.cogs,
            attributedAdSpend: r.attributedAdSpend,
            netProfit: r.netProfit,
            previousNetProfit: prevNet != null ? f4(prevNet) : null,
            netProfitDelta,
          };
        }),
      };
    });
  }

  /** Önceki dönem net kârı: `channelId:productExternalId` → toplam net kâr. */
  private async previousProductNet(
    storeIds: string[],
    from: string,
    to: string,
  ): Promise<Map<string, number>> {
    const prev = previousRange(from, to);
    const rows = await this.db
      .select({
        channelId: productProfitDaily.channelId,
        productExternalId: productProfitDaily.productExternalId,
        netProfit: sql<string>`sum(${productProfitDaily.netProfit})`,
      })
      .from(productProfitDaily)
      .where(
        and(
          inArray(productProfitDaily.channelId, storeIds),
          between(productProfitDaily.date, prev.from, prev.to),
        ),
      )
      .groupBy(productProfitDaily.channelId, productProfitDaily.productExternalId);
    return new Map(
      rows.map((r) => [`${r.channelId}:${r.productExternalId}`, num(r.netProfit)]),
    );
  }

  // ---- Reklam performansı (org genelinde, çok-mağaza) ----

  async adsPerformance(
    storeId: string,
    filter: AnalyticsFilter,
    level: AdLevel,
  ): Promise<AdsPerformanceResponse> {
    return this.cached(storeId, `ads:${level}`, filter, async () => {
      const channels = await resolveStoreChannels(this.db, storeId, filter.storeIds);
      const ids = channels.map((s) => s.id);
      const currency = channels[0]?.currency ?? "USD";
      return this.ads.getOrgPerformance(ids, currency, filter.from, filter.to, level);
    });
  }

  // ---- Yardımcılar ----

  /** Seçili mağaza/aralık için gün+mağaza ham satırları. */
  private async fetchRows(
    storeIds: string[],
    from: string,
    to: string,
  ): Promise<Row[]> {
    if (storeIds.length === 0) return [];
    const rows = await this.db
      .select({
        channelId: dailyStoreMetrics.channelId,
        date: dailyStoreMetrics.date,
        revenue: dailyStoreMetrics.revenue,
        discounts: dailyStoreMetrics.discounts,
        refunds: dailyStoreMetrics.refunds,
        cogs: dailyStoreMetrics.cogs,
        shippingCost: dailyStoreMetrics.shippingCost,
        paymentFees: dailyStoreMetrics.paymentFees,
        taxes: dailyStoreMetrics.taxes,
        adSpend: dailyStoreMetrics.adSpend,
        customExpenses: dailyStoreMetrics.customExpenses,
        ordersCount: dailyStoreMetrics.ordersCount,
        units: dailyStoreMetrics.units,
      })
      .from(dailyStoreMetrics)
      .where(
        and(
          inArray(dailyStoreMetrics.channelId, storeIds),
          between(dailyStoreMetrics.date, from, to),
        ),
      )
      .orderBy(asc(dailyStoreMetrics.date));
    return rows;
  }

  private async loadTotals(storeIds: string[], from: string, to: string) {
    return accumulate(await this.fetchRows(storeIds, from, to));
  }

  /**
   * Özel-metrik değerlendirmesi için taban alan değerleri (sayısal).
   * Anahtarlar `CUSTOM_METRIC_FIELDS` ile eşleşir (revenue..units + netProfit).
   */
  async fieldValues(
    storeId: string,
    filter: AnalyticsFilter,
  ): Promise<{ currency: string; storeIds: string[]; values: Record<string, number> }> {
    const channels = await resolveStoreChannels(this.db, storeId, filter.storeIds);
    const ids = channels.map((s) => s.id);
    const acc = await this.loadTotals(ids, filter.from, filter.to);
    return {
      currency: channels[0]?.currency ?? "USD",
      storeIds: ids,
      values: {
        revenue: acc.revenue,
        discounts: acc.discounts,
        refunds: acc.refunds,
        cogs: acc.cogs,
        shippingCost: acc.shippingCost,
        paymentFees: acc.paymentFees,
        taxes: acc.taxes,
        adSpend: acc.adSpend,
        customExpenses: acc.customExpenses,
        netProfit: dailyNetProfit(acc),
        ordersCount: acc.ordersCount,
        units: acc.units,
      },
    };
  }

  /** Org + uç + filtre anahtarıyla TTL'li cache. */
  private async cached<T>(
    storeId: string,
    endpoint: string,
    filter: AnalyticsFilter,
    fn: () => Promise<T>,
  ): Promise<T> {
    const channels = filter.storeIds.length ? [...filter.storeIds].sort().join(",") : "all";
    const key = `analytics:${storeId}:${endpoint}:${filter.from}:${filter.to}:${channels}:${filter.compare ? 1 : 0}`;
    const hit = await this.redis.get(key);
    if (hit) return JSON.parse(hit) as T;
    const val = await fn();
    await this.redis.set(key, JSON.stringify(val), "EX", CACHE_TTL);
    return val;
  }
}
