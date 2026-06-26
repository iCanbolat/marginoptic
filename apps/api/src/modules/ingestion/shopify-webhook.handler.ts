import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import {
  integrationConnections,
  channels,
} from "../../database/schema/channels";
import { products } from "../../database/schema/sales";
import { GdprService } from "./gdpr.service";
import { IngestionService } from "./ingestion.service";
import {
  extractId,
  normalizeOrder,
  normalizeProduct,
  normalizeRefund,
} from "./normalizers/shopify-normalizer";

type Json = Record<string, unknown>;

/** Net kâr metriklerini etkileyen webhook'un artımlı rollup hedefi. */
export interface WebhookEffect {
  channelId: string;
  /** Etkilenen iş günleri (YYYY-MM-DD) — bu günlerin rollup'ı yeniden çalışmalı. */
  dates: string[];
}

function utcDate(d: Date | null): string {
  return (d ?? new Date()).toISOString().slice(0, 10);
}

/**
 * Shopify webhook'unu topic'e göre normalize edip ilgili tablolara yazar.
 * Mağaza, `x-shopify-shop-domain` ile çözülür; bulunamazsa olay sessizce atlanır.
 * Sipariş/iade değişiklikleri için etkilenen mağaza+gün'ü döner (artımlı rollup).
 */
@Injectable()
export class ShopifyWebhookHandler {
  private readonly logger = new Logger(ShopifyWebhookHandler.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly ingestion: IngestionService,
    private readonly gdpr: GdprService,
  ) {}

  async handle(
    topic: string,
    shop: string,
    payload: unknown,
  ): Promise<WebhookEffect | null> {
    const body = (payload ?? {}) as Json;

    if (topic === "app/uninstalled") {
      await this.markUninstalled(shop);
      return null;
    }

    // GDPR zorunlu webhook'ları — mağaza çözümünü servis kendi yapar.
    switch (topic) {
      case "customers/redact":
        await this.gdpr.redactCustomer(shop, body);
        return null;
      case "shop/redact":
        await this.gdpr.redactShop(shop);
        return null;
      case "customers/data_request":
        await this.gdpr.logDataRequest(shop, body);
        return null;
    }

    const channelId = await this.storeIdForShop(shop);
    if (!channelId) {
      this.logger.warn(`Webhook için mağaza bulunamadı: ${shop} (${topic})`);
      return null;
    }

    switch (topic) {
      case "orders/create":
      case "orders/updated":
      case "orders/cancelled": {
        const order = normalizeOrder(body);
        await this.ingestion.upsertOrder(channelId, order);
        return {
          channelId,
          dates: [utcDate(order.processedAt ?? order.shopifyCreatedAt)],
        };
      }
      case "refunds/create": {
        const refund = normalizeRefund(body);
        const written = await this.ingestion.upsertRefund(
          channelId,
          extractId(body.order_id) || null,
          refund,
        );
        return written
          ? { channelId, dates: [utcDate(refund.processedAt)] }
          : null;
      }
      case "products/create":
      case "products/update":
        await this.ingestion.upsertProduct(channelId, normalizeProduct(body));
        return null;
      case "products/delete":
        await this.db
          .delete(products)
          .where(
            and(
              eq(products.channelId, channelId),
              eq(products.externalId, extractId(body.id)),
            ),
          );
        return null;
      default:
        this.logger.log(`İşlenmeyen webhook topic: ${topic}`);
        return null;
    }
  }

  private async storeIdForShop(shop: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: channels.id })
      .from(channels)
      .where(
        and(eq(channels.channel, "shopify"), eq(channels.externalShopId, shop)),
      )
      .limit(1);
    return row?.id ?? null;
  }

  private async markUninstalled(shop: string): Promise<void> {
    const [store] = await this.db
      .update(channels)
      .set({ status: "disconnected", updatedAt: new Date() })
      .where(
        and(eq(channels.channel, "shopify"), eq(channels.externalShopId, shop)),
      )
      .returning({ id: channels.id });
    if (store) {
      await this.db
        .update(integrationConnections)
        .set({
          status: "disconnected",
          accessTokenEnc: null,
          refreshTokenEnc: null,
          updatedAt: new Date(),
        })
        .where(eq(integrationConnections.channelId, store.id));
    }
    this.logger.log(`Uygulama kaldırıldı: ${shop}`);
  }
}
