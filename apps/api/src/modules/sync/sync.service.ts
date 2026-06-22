import { InjectFlowProducer, InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable } from "@nestjs/common";
import { FlowProducer, Queue, type JobsOptions } from "bullmq";
import { eq } from "drizzle-orm";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { syncState } from "../../database/schema/stores";
import {
  METRICS_FLOW_PRODUCER,
  QUEUE_METRICS_ROLLUP,
  type MetricsRollupJob,
} from "../profit/profit.constants";
import {
  ETSY_SYNC_RESOURCES,
  QUEUE_ETSY_SYNC,
  QUEUE_SHOPIFY_SYNC,
  QUEUE_WEBHOOKS,
  SHOPIFY_SYNC_RESOURCES,
  type EtsySyncJob,
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
    storeId: string;
    shop: string;
  }): Promise<void> {
    for (const resource of SHOPIFY_SYNC_RESOURCES) {
      await this.setSyncState(args.connectionId, resource, "queued");
    }
    await this.flow.add({
      name: "rollup-after-backfill",
      queueName: QUEUE_METRICS_ROLLUP,
      data: { storeId: args.storeId } satisfies MetricsRollupJob,
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
   * Etsy ilk tam içe-aktarımı (listings/receipts/buyers) + sonrasına metrics-rollup
   * zinciri (Shopify ile aynı FlowProducer deseni).
   */
  async enqueueEtsyBackfill(args: {
    connectionId: string;
    storeId: string;
    shopId: string;
  }): Promise<void> {
    for (const resource of ETSY_SYNC_RESOURCES) {
      await this.setSyncState(args.connectionId, resource, "queued");
    }
    await this.flow.add({
      name: "rollup-after-etsy-backfill",
      queueName: QUEUE_METRICS_ROLLUP,
      data: { storeId: args.storeId } satisfies MetricsRollupJob,
      opts: FLOW_JOB_OPTS,
      children: ETSY_SYNC_RESOURCES.map((resource) => ({
        name: `etsy-backfill:${resource}`,
        queueName: QUEUE_ETSY_SYNC,
        data: { ...args, resource } satisfies EtsySyncJob,
        opts: FLOW_JOB_OPTS,
      })),
    });
  }

  /** Webhook artımlı: belirli mağaza/gün(ler) için rollup'ı kuyruğa alır. */
  async enqueueMetricsRollup(storeId: string, range?: {
    from: string;
    to: string;
  }): Promise<void> {
    await this.flow.add({
      name: "rollup-incremental",
      queueName: QUEUE_METRICS_ROLLUP,
      data: { storeId, ...range } satisfies MetricsRollupJob,
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
