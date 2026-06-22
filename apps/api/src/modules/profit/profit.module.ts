import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { CostsModule } from "../costs/costs.module";
import { ContributionService } from "./contribution.service";
import { FxService } from "./fx.service";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";
import { FxRatesProcessor } from "./processors/fx-rates.processor";
import { MetricsRollupProcessor } from "./processors/metrics-rollup.processor";
import { QUEUE_FX_RATES, QUEUE_METRICS_ROLLUP } from "./profit.constants";

/**
 * Faz 5 — Kâr motoru & rollup.
 * Sipariş katkı paylarını (CostResolver + FX ile) gün+mağaza seviyesine indirger;
 * `metrics-rollup` kuyruğu (sync sonrası FlowProducer zinciri + gece scheduler +
 * webhook artımlı) çalıştırır. FX `fx-rates` repeatable job ile güncellenir.
 */
@Module({
  imports: [
    CostsModule, // CostResolverService
    BullModule.registerQueue(
      { name: QUEUE_METRICS_ROLLUP },
      { name: QUEUE_FX_RATES },
    ),
  ],
  controllers: [MetricsController],
  providers: [
    FxService,
    ContributionService,
    MetricsService,
    MetricsRollupProcessor,
    FxRatesProcessor,
  ],
  exports: [MetricsService],
})
export class ProfitModule {}
