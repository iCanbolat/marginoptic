import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { Queue, type Job } from "bullmq";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { DRIZZLE, type DrizzleDB } from "../../../database/database.module";
import {
  integrationConnections,
  syncState,
} from "../../../database/schema/channels";
import {
  MARKETPLACE_POLL_SCHEDULER,
  QUEUE_MARKETPLACE_POLL,
} from "../sync.constants";
import { SyncService } from "../sync.service";

/** Webhook desteklemeyen, polling ile tazelenen satış kanalları. */
const POLL_PROVIDERS = ["ebay", "amazon"] as const;
type PollProvider = (typeof POLL_PROVIDERS)[number];

/** Polling kaçırmamak için son senkron zamanından bu kadar geri örtüşme bırak (ms). */
const OVERLAP_MS = 60 * 60 * 1000;

/**
 * Faz 10 — eBay/Amazon için zamanlanmış artımlı senkron. Bu platformlar Shopify tarzı
 * HMAC webhook'u desteklemediğinden tazelik periyodik polling ile sağlanır. Repeatable
 * scheduler (varsayılan 15 dk) aktif marketplace bağlantılarını tarar ve her biri için
 * `syncState.lastSyncedAt` watermark'ıyla artımlı backfill kuyruğa alır.
 */
@Processor(QUEUE_MARKETPLACE_POLL)
export class MarketplacePollProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(MarketplacePollProcessor.name);

  constructor(
    @InjectQueue(QUEUE_MARKETPLACE_POLL) private readonly queue: Queue,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly sync: SyncService,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    // Her 15 dakikada bir aktif marketplace bağlantılarını artımlı senkronla.
    await this.queue.upsertJobScheduler(
      MARKETPLACE_POLL_SCHEDULER,
      { pattern: "*/15 * * * *" },
      { name: "poll", data: {} },
    );
  }

  async process(_job: Job): Promise<void> {
    const conns = await this.db
      .select({
        id: integrationConnections.id,
        provider: integrationConnections.provider,
        channelId: integrationConnections.channelId,
        externalAccountId: integrationConnections.externalAccountId,
      })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.status, "active"),
          isNotNull(integrationConnections.channelId),
          inArray(integrationConnections.provider, [...POLL_PROVIDERS]),
        ),
      );

    let enqueued = 0;
    for (const conn of conns) {
      if (!conn.channelId) continue;
      const since = await this.watermark(conn.id);
      const shopId = conn.externalAccountId ?? conn.channelId;
      await this.dispatch(conn.provider as PollProvider, {
        connectionId: conn.id,
        channelId: conn.channelId,
        shopId,
        since,
      });
      enqueued += 1;
    }

    if (enqueued > 0) {
      this.logger.log(`Marketplace polling: ${enqueued} bağlantı senkronlandı`);
    }
  }

  /** Bağlantının orders senkronundaki son başarı zamanı − örtüşme → ISO watermark. */
  private async watermark(connectionId: string): Promise<string | undefined> {
    const [row] = await this.db
      .select({ lastSyncedAt: syncState.lastSyncedAt })
      .from(syncState)
      .where(
        and(
          eq(syncState.connectionId, connectionId),
          eq(syncState.resource, "orders"),
        ),
      )
      .limit(1);
    if (!row?.lastSyncedAt) return undefined;
    return new Date(row.lastSyncedAt.getTime() - OVERLAP_MS).toISOString();
  }

  private async dispatch(
    provider: PollProvider,
    args: { connectionId: string; channelId: string; shopId: string; since?: string },
  ): Promise<void> {
    switch (provider) {
      case "ebay":
        await this.sync.enqueueEbayBackfill(args);
        break;
      case "amazon":
        await this.sync.enqueueAmazonBackfill(args);
        break;
    }
  }
}
