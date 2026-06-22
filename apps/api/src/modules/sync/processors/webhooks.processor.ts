import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import type { Redis } from "ioredis";
import { REDIS } from "../../../redis/redis.module";
import { ShopifyWebhookHandler } from "../../ingestion/shopify-webhook.handler";
import { QUEUE_WEBHOOKS, type WebhookJob } from "../sync.constants";
import { SyncService } from "../sync.service";

const DEDUP_TTL_SECONDS = 24 * 60 * 60; // 1 gün

@Processor(QUEUE_WEBHOOKS)
export class WebhooksProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhooksProcessor.name);

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly shopify: ShopifyWebhookHandler,
    private readonly sync: SyncService,
  ) {
    super();
  }

  async process(job: Job<WebhookJob>): Promise<void> {
    const { provider, topic, shop, payload, eventId } = job.data;

    // Tekrarlı teslimat dedup'ı: SETNX başarısızsa (anahtar var) olay işlenmiş demektir.
    if (eventId) {
      const fresh = await this.redis.set(
        `webhook:dedup:${eventId}`,
        "1",
        "EX",
        DEDUP_TTL_SECONDS,
        "NX",
      );
      if (fresh === null) {
        this.logger.log(`Webhook tekrarı atlandı: ${topic} (${eventId})`);
        return;
      }
    }

    if (provider === "shopify") {
      const effect = await this.shopify.handle(topic, shop, payload);
      // Sipariş/iade değiştiyse etkilenen gün(ler)in metriklerini artımlı yeniden hesapla.
      if (effect && effect.dates.length > 0) {
        const sorted = [...effect.dates].sort();
        await this.sync.enqueueMetricsRollup(effect.storeId, {
          from: sorted[0]!,
          to: sorted[sorted.length - 1]!,
        });
      }
    }
    this.logger.log(`Webhook işlendi: ${provider}/${topic} (${shop})`);
  }
}
