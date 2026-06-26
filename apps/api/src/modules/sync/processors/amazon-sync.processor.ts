import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import { CryptoService } from "../../../common/crypto/crypto.service";
import { DRIZZLE, type DrizzleDB } from "../../../database/database.module";
import { integrationConnections } from "../../../database/schema/channels";
import { AmazonBackfillService } from "../../ingestion/amazon-backfill.service";
import { QUEUE_AMAZON_SYNC, type AmazonSyncJob } from "../sync.constants";
import { SyncService } from "../sync.service";

@Processor(QUEUE_AMAZON_SYNC)
export class AmazonSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(AmazonSyncProcessor.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly crypto: CryptoService,
    private readonly sync: SyncService,
    private readonly backfill: AmazonBackfillService,
  ) {
    super();
  }

  async process(job: Job<AmazonSyncJob>): Promise<void> {
    const { connectionId, channelId, resource, shopId, since } = job.data;

    const [conn] = await this.db
      .select({
        status: integrationConnections.status,
        accessTokenEnc: integrationConnections.accessTokenEnc,
      })
      .from(integrationConnections)
      .where(eq(integrationConnections.id, connectionId))
      .limit(1);

    if (!conn || conn.status !== "active" || !conn.accessTokenEnc) {
      await this.sync.setSyncState(connectionId, resource, "error", {
        lastError: "Bağlantı aktif değil veya token yok",
      });
      return;
    }

    this.logger.log(`Amazon backfill başlıyor: ${shopId} → ${resource}`);
    await this.sync.setSyncState(connectionId, resource, "running", {
      stats: { processed: 0, total: null },
      lastError: null,
    });

    try {
      const accessToken = this.crypto.decrypt(conn.accessTokenEnc);
      const { processed, total } = await this.backfill.run(
        { channelId, shopId, accessToken, resource, since },
        async (p, t) => {
          await this.sync.setSyncState(connectionId, resource, "running", {
            stats: { processed: p, total: t },
          });
        },
      );

      await this.sync.setSyncState(connectionId, resource, "done", {
        stats: { processed, total },
        lastSyncedAt: new Date(),
        lastError: null,
      });
      this.logger.log(`Amazon backfill tamamlandı: ${shopId} → ${resource} (${processed})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.sync.setSyncState(connectionId, resource, "error", {
        lastError: message,
      });
      throw err;
    }
  }
}
