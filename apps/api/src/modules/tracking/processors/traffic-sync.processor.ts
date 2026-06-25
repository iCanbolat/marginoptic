import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { Queue, type Job } from "bullmq";
import { ProductTrafficService } from "../product-traffic.service";
import {
  QUEUE_TRAFFIC_SYNC,
  TRAFFIC_SYNC_SCHEDULER,
  type TrafficSyncJob,
} from "../tracking.constants";

/**
 * Amazon/eBay ürün-traffic'ini günlük yeniler (conversion rate kartı için).
 * Boş job → tüm aktif marketplace mağazaları; dolu `storeId` → tek mağaza.
 */
@Processor(QUEUE_TRAFFIC_SYNC)
export class TrafficSyncProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(TrafficSyncProcessor.name);

  constructor(
    @InjectQueue(QUEUE_TRAFFIC_SYNC) private readonly queue: Queue<TrafficSyncJob>,
    private readonly traffic: ProductTrafficService,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    // Her gün 03:30'da marketplace traffic yenile (rollup öncesi).
    await this.queue.upsertJobScheduler(
      TRAFFIC_SYNC_SCHEDULER,
      { pattern: "30 3 * * *" },
      { name: "traffic-daily", data: {} },
    );
  }

  async process(job: Job<TrafficSyncJob>): Promise<void> {
    const storeId = job.data?.storeId;
    if (storeId) {
      await this.traffic.syncMarketplaceTraffic(storeId);
      return;
    }
    const n = await this.traffic.syncAllMarketplaces();
    this.logger.log(`Günlük marketplace traffic: ${n} mağaza güncellendi`);
  }
}
