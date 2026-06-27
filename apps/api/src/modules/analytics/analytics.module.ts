import { Module } from "@nestjs/common";
import { AdsModule } from "../ads/ads.module";
import { BillingModule } from "../billing/billing.module";
import { RequiresFeatureGuard } from "../auth/guards/requires-feature.guard";
import { ProfitModule } from "../profit/profit.module";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { CustomMetricsController } from "./custom-metrics.controller";
import { CustomMetricsService } from "./custom-metrics.service";
import { CustomersService } from "./customers.service";
import { DashboardsController } from "./dashboards.controller";
import { DashboardsService } from "./dashboards.service";
import { ProductAnalyticsService } from "./product-analytics.service";
import { ProductLinksController } from "./product-links.controller";
import { ProductLinksService } from "./product-links.service";

/**
 * Faz 7 — Analytics API & Pano.
 * Org-kapsamlı çok-mağaza okuma uçları (profit-summary/pnl/timeseries/products/ads/
 * customers + store-comparison), güvenli özel-metrik formül değerlendirme ve pano CRUD
 * (widget layout persist). Reklam performansı için `AdsQueryService` yeniden kullanılır.
 */
@Module({
  imports: [AdsModule, ProfitModule, BillingModule],
  controllers: [
    AnalyticsController,
    DashboardsController,
    CustomMetricsController,
    ProductLinksController,
  ],
  providers: [
    AnalyticsService,
    CustomersService,
    DashboardsService,
    CustomMetricsService,
    ProductAnalyticsService,
    ProductLinksService,
    RequiresFeatureGuard,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
