import { Inject, Injectable } from "@nestjs/common";
import { and, asc, between, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type {
  AdDailyPoint,
  AdLevel,
  AdPerformanceRow,
  AdProvider,
  AdsPerformanceResponse,
  AdsSummary,
} from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { adSpend } from "../../database/schema/ads";
import { dailyStoreMetrics } from "../../database/schema/metrics";
import { assertStoreInOrg } from "../costs/store-access";

const num = (v: string | null | undefined): number => Number(v ?? 0);
const r4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const ratio = (n: number, d: number): number | null =>
  d > 0 ? r4(n / d) : null;

/** Faz 6/7 — reklam performansı okuma (kırılım + blended ROAS/POAS). */
@Injectable()
export class AdsQueryService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Tek mağaza (Faz 6, store-scoped uç). */
  async getPerformance(
    storeId: string,
    channelId: string,
    from: string,
    to: string,
    level: AdLevel,
  ): Promise<AdsPerformanceResponse> {
    const store = await assertStoreInOrg(this.db, storeId, channelId);
    return this.performance(
      eq(adSpend.channelId, channelId),
      eq(dailyStoreMetrics.channelId, channelId),
      channelId,
      store.currency,
      from,
      to,
      level,
    );
  }

  /**
   * Org genelinde çok-mağaza (Faz 7, analytics). `storeIds` çağıran tarafından
   * org'a göre doğrulanır; `response.channelId = "*"`.
   */
  async getOrgPerformance(
    storeIds: string[],
    currency: string,
    from: string,
    to: string,
    level: AdLevel,
  ): Promise<AdsPerformanceResponse> {
    if (storeIds.length === 0) {
      return {
        channelId: "*",
        from,
        to,
        level,
        currency,
        summary: emptySummary(),
        rows: [],
        daily: [],
      };
    }
    return this.performance(
      inArray(adSpend.channelId, storeIds),
      inArray(dailyStoreMetrics.channelId, storeIds),
      "*",
      currency,
      from,
      to,
      level,
    );
  }

  /** Ortak çekirdek: mağaza filtresi SQL koşulu olarak verilir. */
  private async performance(
    adStoreCond: SQL,
    metricStoreCond: SQL,
    channelId: string,
    currency: string,
    from: string,
    to: string,
    level: AdLevel,
  ): Promise<AdsPerformanceResponse> {
    const range = between(adSpend.date, from, to);

    // Kırılım: seçilen seviye için varlık-bazında toplam.
    const rows = await this.db
      .select({
        provider: adSpend.provider,
        entityExternalId: adSpend.entityExternalId,
        campaignExternalId: sql<
          string | null
        >`max(${adSpend.campaignExternalId})`,
        name: sql<string | null>`max(${adSpend.name})`,
        spend: sql<string>`sum(${adSpend.spend})`,
        impressions: sql<number>`sum(${adSpend.impressions})::int`,
        clicks: sql<number>`sum(${adSpend.clicks})::int`,
        conversions: sql<string>`sum(${adSpend.conversions})`,
        conversionValue: sql<string>`sum(${adSpend.conversionValue})`,
      })
      .from(adSpend)
      .where(and(adStoreCond, eq(adSpend.level, level), range))
      .groupBy(adSpend.provider, adSpend.entityExternalId)
      .orderBy(desc(sql`sum(${adSpend.spend})`));

    const breakdown: AdPerformanceRow[] = rows.map((r) => ({
      provider: r.provider as AdProvider,
      level,
      entityExternalId: r.entityExternalId,
      campaignExternalId: r.campaignExternalId,
      name: r.name,
      spend: r.spend,
      impressions: r.impressions,
      clicks: r.clicks,
      conversions: r.conversions,
      conversionValue: r.conversionValue,
      currency,
      roas: ratio(num(r.conversionValue), num(r.spend)),
    }));

    // Gün serisi + özet: çift sayımı önlemek için her zaman campaign seviyesi.
    const dailyRows = await this.db
      .select({
        date: adSpend.date,
        spend: sql<string>`sum(${adSpend.spend})`,
        conversionValue: sql<string>`sum(${adSpend.conversionValue})`,
      })
      .from(adSpend)
      .where(and(adStoreCond, eq(adSpend.level, "campaign"), range))
      .groupBy(adSpend.date)
      .orderBy(asc(adSpend.date));

    const daily: AdDailyPoint[] = dailyRows.map((d) => ({
      date: d.date,
      spend: d.spend,
      conversionValue: d.conversionValue,
    }));

    const [agg] = await this.db
      .select({
        spend: sql<string>`coalesce(sum(${adSpend.spend}),0)`,
        impressions: sql<number>`coalesce(sum(${adSpend.impressions}),0)::int`,
        clicks: sql<number>`coalesce(sum(${adSpend.clicks}),0)::int`,
        conversions: sql<string>`coalesce(sum(${adSpend.conversions}),0)`,
        conversionValue: sql<string>`coalesce(sum(${adSpend.conversionValue}),0)`,
      })
      .from(adSpend)
      .where(and(adStoreCond, eq(adSpend.level, "campaign"), range));

    const [metrics] = await this.db
      .select({
        revenue: sql<string>`coalesce(sum(${dailyStoreMetrics.revenue}),0)`,
        netProfit: sql<string>`coalesce(sum(${dailyStoreMetrics.netProfit}),0)`,
      })
      .from(dailyStoreMetrics)
      .where(
        and(metricStoreCond, between(dailyStoreMetrics.date, from, to)),
      );

    const spend = num(agg?.spend);
    const summary: AdsSummary = {
      spend: agg?.spend ?? "0",
      impressions: agg?.impressions ?? 0,
      clicks: agg?.clicks ?? 0,
      conversions: agg?.conversions ?? "0",
      conversionValue: agg?.conversionValue ?? "0",
      roas: ratio(num(agg?.conversionValue), spend),
      revenue: metrics?.revenue ?? "0",
      netProfit: metrics?.netProfit ?? "0",
      blendedRoas: ratio(num(metrics?.revenue), spend),
      poas: ratio(num(metrics?.netProfit), spend),
    };

    return { channelId, from, to, level, currency, summary, rows: breakdown, daily };
  }
}

function emptySummary(): AdsSummary {
  return {
    spend: "0",
    impressions: 0,
    clicks: 0,
    conversions: "0",
    conversionValue: "0",
    roas: null,
    revenue: "0",
    netProfit: "0",
    blendedRoas: null,
    poas: null,
  };
}
