import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  AD_LEVELS,
  analyticsFilterSchema,
  type AdLevel,
  type AdsPerformanceResponse,
  type AnalyticsFilter,
  type CustomerCacResponse,
  type CustomerCohortsResponse,
  type CustomerLtvResponse,
  type PnlResponse,
  type ProductRankingResponse,
  type ProfitSummaryResponse,
  type StoreComparisonResponse,
  type TimeseriesResponse,
} from "@churnify/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  type ActiveOrg,
  CurrentOrg,
} from "../auth/decorators/current-org.decorator";
import { AnalyticsService } from "./analytics.service";
import { CustomersService } from "./customers.service";

const filterPipe = new ZodValidationPipe(analyticsFilterSchema);

function clampLimit(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 20;
  return Math.min(50, Math.max(1, Math.trunc(n)));
}

function parseLevel(raw: string | undefined): AdLevel {
  return (AD_LEVELS as readonly string[]).includes(raw ?? "")
    ? (raw as AdLevel)
    : "campaign";
}

/**
 * Faz 7 — Analytics okuma uçları (org-kapsamlı, çok-mağaza filtreli, Redis cache).
 * Tüm üyeler okuyabilir (RBAC kısıtı yok).
 */
@ApiTags("analytics")
@ApiBearerAuth()
@Controller("analytics")
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly customers: CustomersService,
  ) {}

  @Get("profit-summary")
  profitSummary(
    @CurrentOrg() org: ActiveOrg,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<ProfitSummaryResponse> {
    return this.analytics.profitSummary(org.id, filter);
  }

  @Get("pnl")
  pnl(
    @CurrentOrg() org: ActiveOrg,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<PnlResponse> {
    return this.analytics.pnl(org.id, filter);
  }

  @Get("timeseries")
  timeseries(
    @CurrentOrg() org: ActiveOrg,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<TimeseriesResponse> {
    return this.analytics.timeseries(org.id, filter);
  }

  @Get("store-comparison")
  storeComparison(
    @CurrentOrg() org: ActiveOrg,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<StoreComparisonResponse> {
    return this.analytics.storeComparison(org.id, filter);
  }

  @Get("products")
  products(
    @CurrentOrg() org: ActiveOrg,
    @Query(filterPipe) filter: AnalyticsFilter,
    @Query("limit") limit?: string,
  ): Promise<ProductRankingResponse> {
    return this.analytics.productRanking(org.id, filter, clampLimit(limit));
  }

  @Get("ads/performance")
  adsPerformance(
    @CurrentOrg() org: ActiveOrg,
    @Query(filterPipe) filter: AnalyticsFilter,
    @Query("level") level?: string,
  ): Promise<AdsPerformanceResponse> {
    return this.analytics.adsPerformance(org.id, filter, parseLevel(level));
  }

  @Get("customers/ltv")
  ltv(
    @CurrentOrg() org: ActiveOrg,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<CustomerLtvResponse> {
    return this.customers.ltv(org.id, filter);
  }

  @Get("customers/cac")
  cac(
    @CurrentOrg() org: ActiveOrg,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<CustomerCacResponse> {
    return this.customers.cac(org.id, filter);
  }

  @Get("customers/cohorts")
  cohorts(
    @CurrentOrg() org: ActiveOrg,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<CustomerCohortsResponse> {
    return this.customers.cohorts(org.id, filter);
  }
}
