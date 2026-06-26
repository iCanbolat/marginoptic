import { Module } from "@nestjs/common";
import { AdsModule } from "../ads/ads.module";
import { SyncModule } from "../sync/sync.module";
import { TrackingModule } from "../tracking/tracking.module";
import { ConnectorRegistry } from "./connector.registry";
import { CONNECTORS } from "./connector.types";
import { EbayConnector } from "./ebay/ebay.connector";
import { AmazonConnector } from "./amazon/amazon.connector";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationsService } from "./integrations.service";
import { ShopifyConnector } from "./shopify/shopify.connector";

@Module({
  imports: [SyncModule, AdsModule, TrackingModule],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    ShopifyConnector,
    EbayConnector,
    AmazonConnector,
    {
      provide: CONNECTORS,
      useFactory: (shopify: ShopifyConnector) => [shopify],
      inject: [ShopifyConnector],
    },
    ConnectorRegistry,
  ],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
