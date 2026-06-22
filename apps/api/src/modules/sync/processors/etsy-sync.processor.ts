import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import { CryptoService } from "../../../common/crypto/crypto.service";
import { DRIZZLE, type DrizzleDB } from "../../../database/database.module";
import { integrationConnections } from "../../../database/schema/stores";
import { EtsyBackfillService } from "../../ingestion/etsy-backfill.service";
import { QUEUE_ETSY_SYNC, type EtsySyncJob } from "../sync.constants";
import { SyncService } from "../sync.service";

@Processor(QUEUE_ETSY_SYNC)
export class EtsySyncProcessor extends WorkerHost {
  private readonly logger = new Logger(EtsySyncProcessor.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly crypto: CryptoService,
    private readonly sync: SyncService,
    private readonly backfill: EtsyBackfillService,
  ) {
    super();
  }

  async process(job: Job<EtsySyncJob>): Promise<void> {
    const { connectionId, storeId, resource, shopId } = job.data;

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

    this.logger.log(`Etsy backfill başlıyor: ${shopId} → ${resource}`);
    await this.sync.setSyncState(connectionId, resource, "running", {
      stats: { processed: 0, total: null },
      lastError: null,
    });

    try {
      const accessToken = this.crypto.decrypt(conn.accessTokenEnc);
      const { processed, total } = await this.backfill.run(
        { storeId, shopId, accessToken, resource },
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
      this.logger.log(`Etsy backfill tamamlandı: ${shopId} → ${resource} (${processed})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.sync.setSyncState(connectionId, resource, "error", {
        lastError: message,
      });
      throw err;
    }
  }
}
