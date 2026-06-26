import { Inject, Injectable } from "@nestjs/common";
import { and, between, eq, inArray, sql } from "drizzle-orm";
import type { Redis } from "ioredis";
import type {
  AnalyticsFilter,
  ProductAnalyticsChannel,
  ProductAnalyticsRow,
  ProductMappingStatus,
  ProductOverviewCard,
  ProductOverviewResponse,
  ProductTableQuery,
  ProductTableResponse,
} from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { productProfitDaily } from "../../database/schema/metrics";
import {
  productAdLinks,
  productAdSpendDaily,
  productTrafficDaily,
} from "../../database/schema/product-analytics";
import { REDIS } from "../../redis/redis.module";
import { f4, num } from "./analytics-math";
import { resolveStoreChannels, type StoreChannel } from "./store-channels";

const CACHE_TTL = 300;

/** Bu sayfada gösterilen kanallar. */
const PAGE_CHANNELS = new Set(["shopify", "amazon", "ebay"]);

/** Birleşik ürün satırı (kâr + traffic + eşleştirme), bellek-içi hesaplanır. */
interface CombinedRow {
  channelId: string;
  storeName: string;
  channel: ProductAnalyticsChannel;
  productExternalId: string;
  title: string | null;
  currency: string;
  units: number;
  revenue: number;
  cogs: number;
  adSpend: number;
  netProfit: number;
  sessions: number;
  purchases: number;
  mappingStatus: ProductMappingStatus;
}

const ratio = (n: number, d: number): number | null =>
  d > 0 ? Math.round((n / d) * 1e4) / 1e4 : null;

/**
 * Ürün Analizi okuma katmanı (org-kapsamlı). Overview 4 kartı +
 * ürün tablosu (ürün-bazlı ROAS / reklam harcaması / dönüşüm). product_profit_daily
 * + product_traffic_daily + product_ad_links/product_ad_spend_daily birleştirilir.
 */
@Injectable()
export class ProductAnalyticsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  // ---- Overview (4 kart) ----

  async overview(
    storeId: string,
    filter: AnalyticsFilter,
  ): Promise<ProductOverviewResponse> {
    const key = `analytics:${storeId}:product-overview:${filter.from}:${filter.to}:${
      filter.storeIds.length ? [...filter.storeIds].sort().join(",") : "all"
    }`;
    const hit = await this.redis.get(key);
    if (hit) return JSON.parse(hit) as ProductOverviewResponse;

    const channels = await this.pageStores(storeId, filter.storeIds);
    const ids = channels.map((s) => s.id);
    const currency = channels[0]?.currency ?? "USD";
    const empty = (): ProductOverviewCard => ({
      productExternalId: null,
      title: null,
      channel: null,
      value: null,
      currency: null,
    });

    let result: ProductOverviewResponse;
    if (ids.length === 0) {
      result = {
        from: filter.from,
        to: filter.to,
        storeIds: ids,
        currency,
        topByUnits: empty(),
        topByRevenue: empty(),
        topByNetProfit: empty(),
        topByConversionRate: empty(),
      };
    } else {
      const rows = await this.loadCombined(channels, filter.from, filter.to);
      const top = (
        pick: (r: CombinedRow) => number,
        value: (r: CombinedRow) => string,
        eligible: (r: CombinedRow) => boolean = () => true,
      ): ProductOverviewCard => {
        let best: CombinedRow | null = null;
        for (const r of rows) {
          if (!eligible(r)) continue;
          if (!best || pick(r) > pick(best)) best = r;
        }
        if (!best) return empty();
        return {
          productExternalId: best.productExternalId,
          title: best.title,
          channel: best.channel,
          value: value(best),
          currency: best.currency,
        };
      };

      result = {
        from: filter.from,
        to: filter.to,
        storeIds: ids,
        currency,
        topByUnits: top(
          (r) => r.units,
          (r) => String(r.units),
        ),
        topByRevenue: top(
          (r) => r.revenue,
          (r) => f4(r.revenue),
        ),
        topByNetProfit: top(
          (r) => r.netProfit,
          (r) => f4(r.netProfit),
        ),
        topByConversionRate: top(
          (r) => (r.sessions > 0 ? r.purchases / r.sessions : 0),
          (r) => (ratio(r.purchases, r.sessions) ?? 0).toFixed(4),
          (r) => r.sessions > 0,
        ),
      };
    }

    await this.redis.set(key, JSON.stringify(result), "EX", CACHE_TTL);
    return result;
  }

  // ---- Ürün tablosu ----

  async table(
    storeId: string,
    query: ProductTableQuery,
  ): Promise<ProductTableResponse> {
    const channels = await this.pageStores(storeId, []);
    const filtered = query.channel
      ? channels.filter((s) => s.channel === query.channel)
      : channels;
    const ids = filtered.map((s) => s.id);
    if (ids.length === 0) {
      return {
        from: query.from,
        to: query.to,
        storeIds: ids,
        rows: [],
        total: 0,
        page: query.page,
        pageSize: query.pageSize,
      };
    }

    let rows = await this.loadCombined(filtered, query.from, query.to);

    if (query.search) {
      const q = query.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.title ?? "").toLowerCase().includes(q) ||
          r.productExternalId.toLowerCase().includes(q),
      );
    }

    const sortVal = (r: CombinedRow): number => {
      switch (query.sort) {
        case "units":
          return r.units;
        case "revenue":
          return r.revenue;
        case "adSpend":
          return r.adSpend;
        case "roas":
          return ratio(r.revenue, r.adSpend) ?? -1;
        case "conversionRate":
          return r.sessions > 0 ? r.purchases / r.sessions : -1;
        default:
          return r.netProfit;
      }
    };
    rows.sort((a, b) => sortVal(b) - sortVal(a));

    const total = rows.length;
    const start = (query.page - 1) * query.pageSize;
    const pageRows = rows.slice(start, start + query.pageSize);

    return {
      from: query.from,
      to: query.to,
      storeIds: ids,
      total,
      page: query.page,
      pageSize: query.pageSize,
      rows: pageRows.map(
        (r): ProductAnalyticsRow => ({
          channelId: r.channelId,
          storeName: r.storeName,
          channel: r.channel,
          productExternalId: r.productExternalId,
          title: r.title,
          currency: r.currency,
          units: r.units,
          revenue: f4(r.revenue),
          cogs: f4(r.cogs),
          adSpend: f4(r.adSpend),
          netProfit: f4(r.netProfit),
          roas: ratio(r.revenue, r.adSpend),
          conversionRate: r.sessions > 0 ? ratio(r.purchases, r.sessions) : null,
          mappingStatus: r.mappingStatus,
        }),
      ),
    };
  }

  // ---- Yardımcılar ----

  /** Org mağazaları, bilinmeyen kanallar çıkarılmış. */
  private async pageStores(
    storeId: string,
    requestedIds: string[],
  ): Promise<StoreChannel[]> {
    const channels = await resolveStoreChannels(this.db, storeId, requestedIds);
    return channels.filter((s) => PAGE_CHANNELS.has(s.channel));
  }

  /**
   * Verilen mağazalar/aralık için ürün başına birleşik satırlar:
   * kâr (units/revenue/cogs/adSpend/netProfit) + traffic (sessions/purchases) +
   * eşleştirme durumu (manuel link > otomatik ürün-harcama > yok).
   */
  private async loadCombined(
    channels: StoreChannel[],
    from: string,
    to: string,
  ): Promise<CombinedRow[]> {
    const ids = channels.map((s) => s.id);
    const meta = new Map(
      channels.map((s) => [s.id, { name: s.name, channel: s.channel }]),
    );

    const profitRows = await this.db
      .select({
        channelId: productProfitDaily.channelId,
        productExternalId: productProfitDaily.productExternalId,
        title: sql<string | null>`max(${productProfitDaily.title})`,
        currency: sql<string>`max(${productProfitDaily.currency})`,
        units: sql<number>`sum(${productProfitDaily.units})::int`,
        revenue: sql<string>`sum(${productProfitDaily.revenue})`,
        cogs: sql<string>`sum(${productProfitDaily.cogs})`,
        adSpend: sql<string>`sum(${productProfitDaily.attributedAdSpend})`,
        netProfit: sql<string>`sum(${productProfitDaily.netProfit})`,
      })
      .from(productProfitDaily)
      .where(
        and(
          inArray(productProfitDaily.channelId, ids),
          between(productProfitDaily.date, from, to),
        ),
      )
      .groupBy(
        productProfitDaily.channelId,
        productProfitDaily.productExternalId,
      );

    const trafficRows = await this.db
      .select({
        channelId: productTrafficDaily.channelId,
        productExternalId: productTrafficDaily.productExternalId,
        sessions: sql<number>`sum(${productTrafficDaily.sessions})::int`,
        purchases: sql<number>`sum(${productTrafficDaily.purchases})::int`,
      })
      .from(productTrafficDaily)
      .where(
        and(
          inArray(productTrafficDaily.channelId, ids),
          between(productTrafficDaily.date, from, to),
        ),
      )
      .groupBy(
        productTrafficDaily.channelId,
        productTrafficDaily.productExternalId,
      );
    const trafficByKey = new Map(
      trafficRows.map((r) => [
        `${r.channelId}:${r.productExternalId}`,
        { sessions: r.sessions, purchases: r.purchases },
      ]),
    );

    const manualRows = await this.db
      .selectDistinct({
        channelId: productAdLinks.channelId,
        productExternalId: productAdLinks.productExternalId,
      })
      .from(productAdLinks)
      .where(
        and(
          inArray(productAdLinks.channelId, ids),
          eq(productAdLinks.matchType, "manual"),
        ),
      );
    const manualSet = new Set(
      manualRows.map((r) => `${r.channelId}:${r.productExternalId}`),
    );

    const autoRows = await this.db
      .selectDistinct({
        channelId: productAdSpendDaily.channelId,
        productExternalId: productAdSpendDaily.productExternalId,
      })
      .from(productAdSpendDaily)
      .where(
        and(
          inArray(productAdSpendDaily.channelId, ids),
          between(productAdSpendDaily.date, from, to),
        ),
      );
    const autoSet = new Set(
      autoRows.map((r) => `${r.channelId}:${r.productExternalId}`),
    );

    return profitRows.map((r): CombinedRow => {
      const key = `${r.channelId}:${r.productExternalId}`;
      const traffic = trafficByKey.get(key);
      const m = meta.get(r.channelId);
      const mappingStatus: ProductMappingStatus = manualSet.has(key)
        ? "manual"
        : autoSet.has(key)
          ? "auto"
          : "none";
      return {
        channelId: r.channelId,
        storeName: m?.name ?? "—",
        channel: (m?.channel ?? "shopify") as ProductAnalyticsChannel,
        productExternalId: r.productExternalId,
        title: r.title,
        currency: r.currency,
        units: r.units,
        revenue: num(r.revenue),
        cogs: num(r.cogs),
        adSpend: num(r.adSpend),
        netProfit: num(r.netProfit),
        sessions: traffic?.sessions ?? 0,
        purchases: traffic?.purchases ?? 0,
        mappingStatus,
      };
    });
  }
}
