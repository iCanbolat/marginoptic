import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { IngestionModule } from "../ingestion/ingestion.module";
import { METRICS_FLOW_PRODUCER } from "../profit/profit.constants";
import { EtsySyncProcessor } from "./processors/etsy-sync.processor";
import { ShopifySyncProcessor } from "./processors/shopify-sync.processor";
import { TokenRefreshProcessor } from "./processors/token-refresh.processor";
import { WebhooksProcessor } from "./processors/webhooks.processor";
import {
  QUEUE_ETSY_SYNC,
  QUEUE_SHOPIFY_SYNC,
  QUEUE_TOKEN_REFRESH,
  QUEUE_WEBHOOKS,
} from "./sync.constants";
import { SyncService } from "./sync.service";

@Module({
  imports: [
    IngestionModule,
    BullModule.registerQueue(
      { name: QUEUE_SHOPIFY_SYNC },
      { name: QUEUE_ETSY_SYNC },
      { name: QUEUE_WEBHOOKS },
      { name: QUEUE_TOKEN_REFRESH },
    ),
    // Sync sonrası metrics-rollup zinciri için FlowProducer (parent rollup + child sync).
    BullModule.registerFlowProducer({ name: METRICS_FLOW_PRODUCER }),
  ],
  providers: [
    SyncService,
    ShopifySyncProcessor,
    EtsySyncProcessor,
    WebhooksProcessor,
    TokenRefreshProcessor,
  ],
  exports: [SyncService],
})
export class SyncModule {}
