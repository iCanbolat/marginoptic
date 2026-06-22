import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { Queue, type Job } from "bullmq";
import type { AdProvider } from "@churnify/shared";
import { CryptoService } from "../../../common/crypto/crypto.service";
import { DRIZZLE, type DrizzleDB } from "../../../database/database.module";
import { integrationConnections } from "../../../database/schema/stores";
import { AdConnectorRegistry } from "../../integrations/ads/ad-connector.registry";
import { generateSyntheticAds } from "../../integrations/ads/ads-synthetic";
import { SyncService } from "../../sync/sync.service";
import { AdsIngestionService } from "../ads-ingestion.service";
import { AdsSyncService } from "../ads-sync.service";
import {
  ADS_RESOURCE,
  ADS_SYNC_SCHEDULER,
  QUEUE_ADS_SYNC,
  type AdsSyncJob,
} from "../ads.constants";

/**
 * Reklam insight'larını çeker → normalize → idempotent yazar → metrics rollup tetikler.
 * Dev (`dev_` token) bağlantılarda gerçek sağlayıcı yerine sentetik veri kullanılır
 * (tüm hat: ad_spend → daily_store_metrics.ad_spend → ROAS/POAS gerçek mağaza olmadan).
 */
@Processor(QUEUE_ADS_SYNC)
export class AdsSyncProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(AdsSyncProcessor.name);

  constructor(
    @InjectQueue(QUEUE_ADS_SYNC) private readonly queue: Queue<AdsSyncJob>,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly crypto: CryptoService,
    private readonly registry: AdConnectorRegistry,
    private readonly ingestion: AdsIngestionService,
    private readonly adsSync: AdsSyncService,
    private readonly sync: SyncService,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    // Her gün 04:00'te aktif reklam bağlantılarını artımlı senkronla (rollup 03:00 sonrası).
    await this.queue.upsertJobScheduler(
      ADS_SYNC_SCHEDULER,
      { pattern: "0 4 * * *" },
      { name: "ads-daily", data: {} },
    );
  }

  async process(job: Job<AdsSyncJob>): Promise<void> {
    const { connectionId, storeId, provider, externalAccountId, since, until } =
      job.data ?? {};

    // Scheduler tetiği: aktif bağlantıları kuyruğa al.
    if (!connectionId) {
      const n = await this.adsSync.enqueueAllActive();
      this.logger.log(`Günlük reklam senkron: ${n} bağlantı kuyruğa alındı`);
      return;
    }

    const [conn] = await this.db
      .select({
        status: integrationConnections.status,
        accessTokenEnc: integrationConnections.accessTokenEnc,
        storeId: integrationConnections.storeId,
        provider: integrationConnections.provider,
        externalAccountId: integrationConnections.externalAccountId,
      })
      .from(integrationConnections)
      .where(eq(integrationConnections.id, connectionId))
      .limit(1);

    const effectiveStoreId = storeId ?? conn?.storeId ?? null;
    if (!conn || conn.status !== "active" || !conn.accessTokenEnc || !effectiveStoreId) {
      await this.sync.setSyncState(connectionId, ADS_RESOURCE, "error", {
        lastError: "Bağlantı aktif değil, token yok veya mağaza atanmamış",
      });
      return;
    }

    const prov = (provider ?? conn.provider) as AdProvider;
    const account = externalAccountId ?? conn.externalAccountId ?? "";

    await this.sync.setSyncState(connectionId, ADS_RESOURCE, "running", {
      stats: { entities: 0, spend: 0 },
      lastError: null,
    });

    try {
      const accessToken = this.crypto.decrypt(conn.accessTokenEnc);
      const result = accessToken.startsWith("dev_")
        ? generateSyntheticAds(account)
        : await this.registry.get(prov).fetchInsights({
            accessToken,
            externalAccountId: account,
            since: since ?? "",
            until: until ?? "",
          });

      const counts = await this.ingestion.upsertInsights(
        effectiveStoreId,
        connectionId,
        prov,
        result,
      );

      await this.sync.setSyncState(connectionId, ADS_RESOURCE, "done", {
        stats: { processed: counts.spend, total: counts.spend, ...counts },
        lastSyncedAt: new Date(),
        lastError: null,
      });

      // Reklam harcaması metriklere katılsın → mağazayı tam yeniden hesapla.
      await this.sync.enqueueMetricsRollup(effectiveStoreId);
      this.logger.log(
        `Reklam senkron ${prov} ${account}: ${counts.entities} varlık / ${counts.spend} harcama satırı`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.sync.setSyncState(connectionId, ADS_RESOURCE, "error", {
        lastError: message,
      });
      throw err;
    }
  }
}
