import { Module } from "@nestjs/common";
import { EtsyConnector } from "../integrations/etsy/etsy.connector";
import { IngestionController } from "./ingestion.controller";
import { IngestionQueryService } from "./ingestion-query.service";
import { IngestionService } from "./ingestion.service";
import { GdprService } from "./gdpr.service";
import { EtsyBackfillService } from "./etsy-backfill.service";
import { ShopifyBackfillService } from "./shopify-backfill.service";
import { ShopifyWebhookHandler } from "./shopify-webhook.handler";
import { ShopifyBulkService } from "./shopify/shopify-bulk.service";
import { ShopifyGraphqlClient } from "./shopify/shopify-graphql.client";

/**
 * Faz 3/9 — Shopify + Etsy veri alımı. Normalizasyon + idempotent upsert + backfill
 * (Shopify Bulk, Etsy Open API v3) + webhook işleme + okuma sorguları. Sync kuyruğu
 * (processor'lar) ve Integrations bu modülü kullanır.
 */
@Module({
  controllers: [IngestionController],
  providers: [
    IngestionService,
    IngestionQueryService,
    ShopifyGraphqlClient,
    ShopifyBulkService,
    ShopifyBackfillService,
    ShopifyWebhookHandler,
    GdprService,
    EtsyConnector,
    EtsyBackfillService,
  ],
  exports: [
    IngestionService,
    ShopifyBackfillService,
    ShopifyWebhookHandler,
    EtsyBackfillService,
  ],
})
export class IngestionModule {}
