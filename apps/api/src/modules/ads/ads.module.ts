import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { AdConnectorRegistry } from "../integrations/ads/ad-connector.registry";
import { AD_CONNECTORS } from "../integrations/ads/ad-connector.types";
import { GoogleAdsConnector } from "../integrations/ads/google.connector";
import { MetaConnector } from "../integrations/ads/meta.connector";
import { TikTokAdsConnector } from "../integrations/ads/tiktok.connector";
import { SyncModule } from "../sync/sync.module";
import { AdsController } from "./ads.controller";
import { AdsIngestionService } from "./ads-ingestion.service";
import { AdsQueryService } from "./ads-query.service";
import { AdsSyncService } from "./ads-sync.service";
import { AdsSyncProcessor } from "./processors/ads-sync.processor";
import { QUEUE_ADS_SYNC } from "./ads.constants";

/**
 * Faz 6 — Reklam entegrasyonları & attribution.
 * Meta/Google/TikTok connector'ları (OAuth + insights), `ads-sync` kuyruğu (backfill +
 * günlük artımlı), idempotent ingestion ve performans okuma. Harcama metrics-rollup'a
 * (blended) katılır. `AdConnectorRegistry` + `AdsSyncService` Integrations'a export edilir.
 */
@Module({
  imports: [SyncModule, BullModule.registerQueue({ name: QUEUE_ADS_SYNC })],
  controllers: [AdsController],
  providers: [
    MetaConnector,
    GoogleAdsConnector,
    TikTokAdsConnector,
    {
      provide: AD_CONNECTORS,
      useFactory: (
        meta: MetaConnector,
        google: GoogleAdsConnector,
        tiktok: TikTokAdsConnector,
      ) => [meta, google, tiktok],
      inject: [MetaConnector, GoogleAdsConnector, TikTokAdsConnector],
    },
    AdConnectorRegistry,
    AdsIngestionService,
    AdsSyncService,
    AdsQueryService,
    AdsSyncProcessor,
  ],
  exports: [AdsSyncService, AdConnectorRegistry, AdsQueryService],
})
export class AdsModule {}
