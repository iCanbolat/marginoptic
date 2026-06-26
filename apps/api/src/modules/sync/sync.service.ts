import { InjectFlowProducer, InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable } from "@nestjs/common";
import { FlowProducer, Queue, type JobsOptions } from "bullmq";
import { eq } from "drizzle-orm";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { syncState } from "../../database/schema/channels";
import {
  METRICS_FLOW_PRODUCER,
  QUEUE_METRICS_ROLLUP,
  type MetricsRollupJob,
} from "../profit/profit.constants";
import {
  AMAZON_SYNC_RESOURCES,
  EBAY_SYNC_RESOURCES,
  QUEUE_AMAZON_SYNC,
  QUEUE_EBAY_SYNC,
  QUEUE_SHOPIFY_SYNC,
  QUEUE_WEBHOOKS,
  SHOPIFY_SYNC_RESOURCES,
  type AmazonSyncJob,
  type EbaySyncJob,
  type ShopifySyncJob,
  type SyncStatusValue,
  type WebhookJob,
} from "./sync.constants";

interface SyncStatePatch {
  cursor?: string | null;
  lastError?: string | null;
  lastSyncedAt?: Date;
  stats?: Record<string, unknown>;
}

/** Flow düğümleri için iş seçenekleri (forRoot defaultJobOptions'ı yansıtır). */
const FLOW_JOB_OPTS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 24 * 3600 },
};

@Injectable()
export class SyncService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectQueue(QUEUE_WEBHOOKS) private readonly webhookQueue: Queue<WebhookJob>,
    @InjectFlowProducer(METRICS_FLOW_PRODUCER)
    private readonly flow: FlowProducer,
  ) {}

  /**
   * İlk tam içe-aktarımı (orders/products/customers) kuyruğa alır ve sonrasına
   * metrics-rollup zincirler: 3 sync child job'ı bitince parent rollup çalışır.
   */
  async enqueueShopifyBackfill(args: {
    connectionId: string;
    channelId: string;
    shop: string;
  }): Promise<void> {
    for (const resource of SHOPIFY_SYNC_RESOURCES) {
      await this.setSyncState(args.connectionId, resource, "queued");
    }
    await this.flow.add({
      name: "rollup-after-backfill",
      queueName: QUEUE_METRICS_ROLLUP,
      data: { channelId: args.channelId } satisfies MetricsRollupJob,
      opts: FLOW_JOB_OPTS,
      children: SHOPIFY_SYNC_RESOURCES.map((resource) => ({
        name: `backfill:${resource}`,
        queueName: QUEUE_SHOPIFY_SYNC,
        data: { ...args, resource } satisfies ShopifySyncJob,
        opts: FLOW_JOB_OPTS,
      })),
    });
  }

  /**
   * eBay ilk tam içe-aktarımı veya polling artımlı senkronu (inventory/orders/buyers) +
   * sonrasına metrics-rollup zinciri (Shopify ile aynı FlowProducer deseni). `since` verilirse
   * orders artımlı çekilir (polling watermark).
   */
  async enqueueEbayBackfill(args: {
    connectionId: string;
    channelId: string;
    shopId: string;
    since?: string;
  }): Promise<void> {
    for (const resource of EBAY_SYNC_RESOURCES) {
      await this.setSyncState(args.connectionId, resource, "queued");
    }
    await this.flow.add({
      name: "rollup-after-ebay-backfill",
      queueName: QUEUE_METRICS_ROLLUP,
      data: { channelId: args.channelId } satisfies MetricsRollupJob,
      opts: FLOW_JOB_OPTS,
      children: EBAY_SYNC_RESOURCES.map((resource) => ({
        name: `ebay-backfill:${resource}`,
        queueName: QUEUE_EBAY_SYNC,
        data: { ...args, resource } satisfies EbaySyncJob,
        opts: FLOW_JOB_OPTS,
      })),
    });
  }

  /**
   * Amazon ilk tam içe-aktarımı veya polling artımlı senkronu (listings/orders/buyers) +
   * sonrasına metrics-rollup zinciri (eBay ile aynı FlowProducer deseni). `since` verilirse
   * orders artımlı çekilir (polling watermark).
   */
  async enqueueAmazonBackfill(args: {
    connectionId: string;
    channelId: string;
    shopId: string;
    since?: string;
  }): Promise<void> {
    for (const resource of AMAZON_SYNC_RESOURCES) {
      await this.setSyncState(args.connectionId, resource, "queued");
    }
    await this.flow.add({
      name: "rollup-after-amazon-backfill",
      queueName: QUEUE_METRICS_ROLLUP,
      data: { channelId: args.channelId } satisfies MetricsRollupJob,
      opts: FLOW_JOB_OPTS,
      children: AMAZON_SYNC_RESOURCES.map((resource) => ({
        name: `amazon-backfill:${resource}`,
        queueName: QUEUE_AMAZON_SYNC,
        data: { ...args, resource } satisfies AmazonSyncJob,
        opts: FLOW_JOB_OPTS,
      })),
    });
  }

  /** Webhook artımlı: belirli mağaza/gün(ler) için rollup'ı kuyruğa alır. */
  async enqueueMetricsRollup(channelId: string, range?: {
    from: string;
    to: string;
  }): Promise<void> {
    await this.flow.add({
      name: "rollup-incremental",
      queueName: QUEUE_METRICS_ROLLUP,
      data: { channelId, ...range } satisfies MetricsRollupJob,
      opts: FLOW_JOB_OPTS,
    });
  }

  async enqueueWebhook(job: WebhookJob): Promise<void> {
    await this.webhookQueue.add(`${job.provider}:${job.topic}`, job);
  }

  async setSyncState(
    connectionId: string,
    resource: string,
    status: SyncStatusValue,
    patch: SyncStatePatch = {},
  ): Promise<void> {
    const now = new Date();
    await this.db
      .insert(syncState)
      .values({ connectionId, resource, status, ...patch, updatedAt: now })
      .onConflictDoUpdate({
        target: [syncState.connectionId, syncState.resource],
        set: { status, ...patch, updatedAt: now },
      });
  }

  listForConnection(connectionId: string) {
    return this.db
      .select()
      .from(syncState)
      .where(eq(syncState.connectionId, connectionId));
  }
}
