import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import { CryptoService } from "../../../common/crypto/crypto.service";
import { DRIZZLE, type DrizzleDB } from "../../../database/database.module";
import { integrationConnections } from "../../../database/schema/stores";
import { ShopifyBackfillService } from "../../ingestion/shopify-backfill.service";
import { QUEUE_SHOPIFY_SYNC, type ShopifySyncJob } from "../sync.constants";
import { SyncService } from "../sync.service";

@Processor(QUEUE_SHOPIFY_SYNC)
export class ShopifySyncProcessor extends WorkerHost {
  private readonly logger = new Logger(ShopifySyncProcessor.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly crypto: CryptoService,
    private readonly sync: SyncService,
    private readonly backfill: ShopifyBackfillService,
  ) {
    super();
  }

  async process(job: Job<ShopifySyncJob>): Promise<void> {
    const { connectionId, storeId, resource, shop } = job.data;

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

    this.logger.log(`Backfill başlıyor: ${shop} → ${resource}`);
    await this.sync.setSyncState(connectionId, resource, "running", {
      stats: { processed: 0, total: null },
      lastError: null,
    });

    try {
      const accessToken = this.crypto.decrypt(conn.accessTokenEnc);
      const { processed, total } = await this.backfill.run(
        { storeId, shop, accessToken, resource },
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
      this.logger.log(`Backfill tamamlandı: ${shop} → ${resource} (${processed})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.sync.setSyncState(connectionId, resource, "error", {
        lastError: message,
      });
      throw err;
    }
  }
}
