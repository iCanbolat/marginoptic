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
 * - Parent job (sync sonrası FlowProducer zinciri): `{ channelId }` → mağazayı tam hesapla.
 * - Artımlı (webhook): `{ channelId, from, to }` → yalnız o aralığı hesapla.
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
    const { channelId, from, to } = job.data ?? {};

    if (channelId && from && to) {
      const days = await this.metrics.rollupStore(channelId, { from, to });
      this.logger.log(`Artımlı rollup ${channelId} ${from}→${to}: ${days} gün`);
      return;
    }
    if (channelId) {
      const days = await this.metrics.rollupStore(channelId);
      this.logger.log(`Tam rollup ${channelId}: ${days} gün`);
      return;
    }
    const total = await this.metrics.rollupAllActive();
    this.logger.log(`Gece rollup (tüm aktif mağazalar): ${total} gün`);
  }
}
