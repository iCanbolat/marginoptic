import { Inject, Injectable } from "@nestjs/common";
import type { AdLevel, AnalyticsFilter } from "@churnify/shared";
import type {
  ComparePeriodsResult,
  McpDataProvider,
  McpStoreInfo,
  McpToolContext,
} from "@churnify/mcp";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { AnalyticsService } from "../analytics/analytics.service";
import { num, pctChange } from "../analytics/analytics-math";
import { resolveOrgStores } from "../analytics/org-stores";

/**
 * Faz 8 — MCP tool'larının somut veri kaynağı.
 * Analytics REST uçlarıyla **aynı** servis metodlarını çağırır → MCP sonucu REST ile birebir.
 */
@Injectable()
export class McpDataProviderService implements McpDataProvider {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly analytics: AnalyticsService,
  ) {}

  async listStores(ctx: McpToolContext): Promise<McpStoreInfo[]> {
    const stores = await resolveOrgStores(this.db, ctx.orgId, []);
    return stores.map((s) => ({
      id: s.id,
      name: s.name,
      currency: s.currency,
      channel: s.channel,
    }));
  }

  getProfitSummary(ctx: McpToolContext, filter: AnalyticsFilter) {
    return this.analytics.profitSummary(ctx.orgId, filter);
  }

  getPnl(ctx: McpToolContext, filter: AnalyticsFilter) {
    return this.analytics.pnl(ctx.orgId, filter);
  }

  topProductsByProfit(
    ctx: McpToolContext,
    filter: AnalyticsFilter,
    limit: number,
  ) {
    return this.analytics.productRanking(ctx.orgId, filter, limit);
  }

  getAdPerformance(
    ctx: McpToolContext,
    filter: AnalyticsFilter,
    level: AdLevel,
  ) {
    return this.analytics.adsPerformance(ctx.orgId, filter, level);
  }

  async comparePeriods(
    ctx: McpToolContext,
    a: { from: string; to: string },
    b: { from: string; to: string },
    storeIds: string[],
  ): Promise<ComparePeriodsResult> {
    const [ra, rb] = await Promise.all([
      this.analytics.profitSummary(ctx.orgId, {
        from: a.from,
        to: a.to,
        storeIds,
        compare: false,
      }),
      this.analytics.profitSummary(ctx.orgId, {
        from: b.from,
        to: b.to,
        storeIds,
        compare: false,
      }),
    ]);
    const ta = ra.totals;
    const tb = rb.totals;
    return {
      currency: ra.currency,
      storeIds: ra.storeIds,
      a: { from: a.from, to: a.to, totals: ta },
      b: { from: b.from, to: b.to, totals: tb },
      deltas: {
        revenue: pctChange(num(ta.revenue), num(tb.revenue)),
        netProfit: pctChange(num(ta.netProfit), num(tb.netProfit)),
        ordersCount: pctChange(ta.ordersCount, tb.ordersCount),
        adSpend: pctChange(num(ta.adSpend), num(tb.adSpend)),
        margin:
          ta.margin != null && tb.margin != null
            ? Math.round((ta.margin - tb.margin) * 100) / 100
            : null,
      },
    };
  }
}
