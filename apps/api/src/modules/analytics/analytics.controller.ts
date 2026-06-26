import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  AD_LEVELS,
  analyticsFilterSchema,
  productTableQuerySchema,
  type AdLevel,
  type AdsPerformanceResponse,
  type AnalyticsFilter,
  type CustomerCacResponse,
  type CustomerCohortsResponse,
  type CustomerLtvResponse,
  type PnlResponse,
  type ProductOverviewResponse,
  type ProductRankingResponse,
  type ProductTableQuery,
  type ProductTableResponse,
  type ProfitSummaryResponse,
  type StoreComparisonResponse,
  type TimeseriesResponse,
} from "@churnify/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  type ActiveStore,
  CurrentStore,
} from "../auth/decorators/current-store.decorator";
import { AnalyticsService } from "./analytics.service";
import { CustomersService } from "./customers.service";
import { ProductAnalyticsService } from "./product-analytics.service";

const filterPipe = new ZodValidationPipe(analyticsFilterSchema);
const productTablePipe = new ZodValidationPipe(productTableQuerySchema);

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
    private readonly productAnalytics: ProductAnalyticsService,
  ) {}

  @Get("profit-summary")
  profitSummary(
    @CurrentStore() org: ActiveStore,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<ProfitSummaryResponse> {
    return this.analytics.profitSummary(org.id, filter);
  }

  @Get("pnl")
  pnl(
    @CurrentStore() org: ActiveStore,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<PnlResponse> {
    return this.analytics.pnl(org.id, filter);
  }

  @Get("timeseries")
  timeseries(
    @CurrentStore() org: ActiveStore,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<TimeseriesResponse> {
    return this.analytics.timeseries(org.id, filter);
  }

  @Get("store-comparison")
  storeComparison(
    @CurrentStore() org: ActiveStore,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<StoreComparisonResponse> {
    return this.analytics.storeComparison(org.id, filter);
  }

  @Get("products")
  products(
    @CurrentStore() org: ActiveStore,
    @Query(filterPipe) filter: AnalyticsFilter,
    @Query("limit") limit?: string,
  ): Promise<ProductRankingResponse> {
    return this.analytics.productRanking(org.id, filter, clampLimit(limit));
  }

  @Get("ads/performance")
  adsPerformance(
    @CurrentStore() org: ActiveStore,
    @Query(filterPipe) filter: AnalyticsFilter,
    @Query("level") level?: string,
  ): Promise<AdsPerformanceResponse> {
    return this.analytics.adsPerformance(org.id, filter, parseLevel(level));
  }

  /** Ürün Analizi overview: 3 platform → 4 kart. */
  @Get("product-overview")
  productOverview(
    @CurrentStore() org: ActiveStore,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<ProductOverviewResponse> {
    return this.productAnalytics.overview(org.id, filter);
  }

  /** Ürün tablosu: ürün-bazlı ROAS / reklam harcaması / dönüşüm (sayfalı). */
  @Get("product-table")
  productTable(
    @CurrentStore() org: ActiveStore,
    @Query(productTablePipe) query: ProductTableQuery,
  ): Promise<ProductTableResponse> {
    return this.productAnalytics.table(org.id, query);
  }

  @Get("customers/ltv")
  ltv(
    @CurrentStore() org: ActiveStore,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<CustomerLtvResponse> {
    return this.customers.ltv(org.id, filter);
  }

  @Get("customers/cac")
  cac(
    @CurrentStore() org: ActiveStore,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<CustomerCacResponse> {
    return this.customers.cac(org.id, filter);
  }

  @Get("customers/cohorts")
  cohorts(
    @CurrentStore() org: ActiveStore,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<CustomerCohortsResponse> {
    return this.customers.cohorts(org.id, filter);
  }
}
