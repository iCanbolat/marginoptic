import { Module } from "@nestjs/common";
import { EbayConnector } from "../integrations/ebay/ebay.connector";
import { AmazonConnector } from "../integrations/amazon/amazon.connector";
import { IngestionController } from "./ingestion.controller";
import { IngestionQueryService } from "./ingestion-query.service";
import { IngestionService } from "./ingestion.service";
import { GdprService } from "./gdpr.service";
import { EbayBackfillService } from "./ebay-backfill.service";
import { AmazonBackfillService } from "./amazon-backfill.service";
import { ShopifyBackfillService } from "./shopify-backfill.service";
import { ShopifyWebhookHandler } from "./shopify-webhook.handler";
import { ShopifyBulkService } from "./shopify/shopify-bulk.service";
import { ShopifyGraphqlClient } from "./shopify/shopify-graphql.client";

/**
 * Faz 3/9/10 — Shopify + eBay + Amazon veri alımı. Normalizasyon + idempotent
 * upsert + backfill (Shopify Bulk, eBay Sell API, Amazon SP-API) + webhook
 * işleme + okuma sorguları. Sync kuyruğu (processor'lar) ve Integrations bu modülü kullanır.
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
    EbayConnector,
    EbayBackfillService,
    AmazonConnector,
    AmazonBackfillService,
  ],
  exports: [
    IngestionService,
    ShopifyBackfillService,
    ShopifyWebhookHandler,
    EbayBackfillService,
    AmazonBackfillService,
  ],
})
export class IngestionModule {}
