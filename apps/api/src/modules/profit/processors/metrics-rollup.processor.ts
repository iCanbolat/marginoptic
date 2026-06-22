import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { Queue, type Job } from "bullmq";
import { MetricsService } from "../metrics.service";
import {
  METRICS_ROLLUP_SCHEDULER,
  QUEUE_METRICS_ROLLUP,
  type MetricsRollupJob,
} from "../profit.constants";

/**
 * Gün+mağaza rollup'ını işler.
 * - Parent job (sync sonrası FlowProducer zinciri): `{ storeId }` → mağazayı tam hesapla.
 * - Artımlı (webhook): `{ storeId, from, to }` → yalnız o aralığı hesapla.
 * - Gece scheduler: `{}` → tüm aktif mağazaları tam hesapla.
 */
@Processor(QUEUE_METRICS_ROLLUP)
export class MetricsRollupProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(MetricsRollupProcessor.name);

  constructor(
    @InjectQueue(QUEUE_METRICS_ROLLUP)
    private readonly queue: Queue<MetricsRollupJob>,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    // Her gece 03:00'te (recurring-expenses 02:00 sonrası) tam rollup.
    await this.queue.upsertJobScheduler(
      METRICS_ROLLUP_SCHEDULER,
      { pattern: "0 3 * * *" },
      { name: "nightly", data: {} },
    );
  }

  async process(job: Job<MetricsRollupJob>): Promise<void> {
    const { storeId, from, to } = job.data ?? {};

    if (storeId && from && to) {
      const days = await this.metrics.rollupStore(storeId, { from, to });
      this.logger.log(`Artımlı rollup ${storeId} ${from}→${to}: ${days} gün`);
      return;
    }
    if (storeId) {
      const days = await this.metrics.rollupStore(storeId);
      this.logger.log(`Tam rollup ${storeId}: ${days} gün`);
      return;
    }
    const total = await this.metrics.rollupAllActive();
    this.logger.log(`Gece rollup (tüm aktif mağazalar): ${total} gün`);
  }
}
