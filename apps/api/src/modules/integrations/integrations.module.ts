import { Module } from "@nestjs/common";
import { AdsModule } from "../ads/ads.module";
import { BillingModule } from "../billing/billing.module";
import { SyncModule } from "../sync/sync.module";
import { ConnectorRegistry } from "./connector.registry";
import { CONNECTORS } from "./connector.types";
import { EtsyConnector } from "./etsy/etsy.connector";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationsService } from "./integrations.service";
import { ShopifyConnector } from "./shopify/shopify.connector";

@Module({
  imports: [SyncModule, AdsModule, BillingModule],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    ShopifyConnector,
    EtsyConnector,
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
