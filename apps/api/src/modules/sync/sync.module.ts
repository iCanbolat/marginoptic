import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { IngestionModule } from "../ingestion/ingestion.module";
import { METRICS_FLOW_PRODUCER } from "../profit/profit.constants";
import { AmazonSyncProcessor } from "./processors/amazon-sync.processor";
import { EbaySyncProcessor } from "./processors/ebay-sync.processor";
import { MarketplacePollProcessor } from "./processors/marketplace-poll.processor";
import { ShopifySyncProcessor } from "./processors/shopify-sync.processor";
import { TokenRefreshProcessor } from "./processors/token-refresh.processor";
import { WebhooksProcessor } from "./processors/webhooks.processor";
import {
  QUEUE_AMAZON_SYNC,
  QUEUE_EBAY_SYNC,
  QUEUE_MARKETPLACE_POLL,
  QUEUE_SHOPIFY_SYNC,
  QUEUE_TOKEN_REFRESH,
  QUEUE_WEBHOOKS,
} from "./sync.constants";
import { SyncService } from "./sync.service";

@Module({
  imports: [
    IngestionModule,
    BillingModule,
    BullModule.registerQueue(
      { name: QUEUE_SHOPIFY_SYNC },
      { name: QUEUE_EBAY_SYNC },
      { name: QUEUE_AMAZON_SYNC },
      { name: QUEUE_MARKETPLACE_POLL },
      { name: QUEUE_WEBHOOKS },
      { name: QUEUE_TOKEN_REFRESH },
    ),
    // Sync sonrası metrics-rollup zinciri için FlowProducer (parent rollup + child sync).
    BullModule.registerFlowProducer({ name: METRICS_FLOW_PRODUCER }),
  ],
  providers: [
    SyncService,
    ShopifySyncProcessor,
    EbaySyncProcessor,
    AmazonSyncProcessor,
    MarketplacePollProcessor,
    WebhooksProcessor,
    TokenRefreshProcessor,
  ],
  exports: [SyncService],
})
export class SyncModule {}
