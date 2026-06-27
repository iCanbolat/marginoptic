import { Controller, Get, Query, UseGuards } from "@nestjs/common";
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
import { RequiresFeature } from "../auth/decorators/requires-feature.decorator";
import {
  type ActiveStore,
  CurrentStore,
} from "../auth/decorators/current-store.decorator";
import { RequiresFeatureGuard } from "../auth/guards/requires-feature.guard";
import { BillingService } from "../billing/billing.service";
import { AnalyticsService } from "./analytics.service";
import { CustomersService } from "./customers.service";
import { clampFromToLookback } from "./lookback.util";
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
 * Tüm üyeler okuyabilir (RBAC kısıtı yok). Plan gating:
 *  - look-back: tarih aralığı planın penceresine sessizce kıstırılır (`clampFilter`).
 *  - Pro özellikleri: ürün/kampanya kârlılığı uçları `@RequiresFeature` ile korunur.
 */
@ApiTags("analytics")
@ApiBearerAuth()
@UseGuards(RequiresFeatureGuard)
@Controller("analytics")
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly customers: CustomersService,
    private readonly productAnalytics: ProductAnalyticsService,
    private readonly billing: BillingService,
  ) {}

  /** `from` tarihini mağaza planının look-back penceresine kıstırır. */
  private async clampFilter(
    storeId: string,
    filter: AnalyticsFilter,
  ): Promise<AnalyticsFilter> {
    const days = await this.billing.lookbackDaysForStore(storeId);
    return { ...filter, from: clampFromToLookback(filter.from, days) };
  }

  @Get("profit-summary")
  async profitSummary(
    @CurrentStore() org: ActiveStore,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<ProfitSummaryResponse> {
    return this.analytics.profitSummary(org.id, await this.clampFilter(org.id, filter));
  }

  @Get("pnl")
  async pnl(
    @CurrentStore() org: ActiveStore,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<PnlResponse> {
    return this.analytics.pnl(org.id, await this.clampFilter(org.id, filter));
  }

  @Get("timeseries")
  async timeseries(
    @CurrentStore() org: ActiveStore,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<TimeseriesResponse> {
    return this.analytics.timeseries(org.id, await this.clampFilter(org.id, filter));
  }

  @Get("store-comparison")
  async storeComparison(
    @CurrentStore() org: ActiveStore,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<StoreComparisonResponse> {
    return this.analytics.storeComparison(
      org.id,
      await this.clampFilter(org.id, filter),
    );
  }

  @Get("products")
  @RequiresFeature("productProfitability")
  async products(
    @CurrentStore() org: ActiveStore,
    @Query(filterPipe) filter: AnalyticsFilter,
    @Query("limit") limit?: string,
  ): Promise<ProductRankingResponse> {
    return this.analytics.productRanking(
      org.id,
      await this.clampFilter(org.id, filter),
      clampLimit(limit),
    );
  }

  @Get("ads/performance")
  @RequiresFeature("campaignProfitability")
  async adsPerformance(
    @CurrentStore() org: ActiveStore,
    @Query(filterPipe) filter: AnalyticsFilter,
    @Query("level") level?: string,
  ): Promise<AdsPerformanceResponse> {
    return this.analytics.adsPerformance(
      org.id,
      await this.clampFilter(org.id, filter),
      parseLevel(level),
    );
  }

  /** Ürün Analizi overview: 3 platform → 4 kart. */
  @Get("product-overview")
  @RequiresFeature("productProfitability")
  async productOverview(
    @CurrentStore() org: ActiveStore,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<ProductOverviewResponse> {
    return this.productAnalytics.overview(
      org.id,
      await this.clampFilter(org.id, filter),
    );
  }

  /** Ürün tablosu: ürün-bazlı ROAS / reklam harcaması / dönüşüm (sayfalı). */
  @Get("product-table")
  @RequiresFeature("productProfitability")
  async productTable(
    @CurrentStore() org: ActiveStore,
    @Query(productTablePipe) query: ProductTableQuery,
  ): Promise<ProductTableResponse> {
    const days = await this.billing.lookbackDaysForStore(org.id);
    return this.productAnalytics.table(org.id, {
      ...query,
      from: clampFromToLookback(query.from, days),
    });
  }

  @Get("customers/ltv")
  async ltv(
    @CurrentStore() org: ActiveStore,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<CustomerLtvResponse> {
    return this.customers.ltv(org.id, await this.clampFilter(org.id, filter));
  }

  @Get("customers/cac")
  async cac(
    @CurrentStore() org: ActiveStore,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<CustomerCacResponse> {
    return this.customers.cac(org.id, await this.clampFilter(org.id, filter));
  }

  @Get("customers/cohorts")
  async cohorts(
    @CurrentStore() org: ActiveStore,
    @Query(filterPipe) filter: AnalyticsFilter,
  ): Promise<CustomerCohortsResponse> {
    return this.customers.cohorts(org.id, await this.clampFilter(org.id, filter));
  }
}
