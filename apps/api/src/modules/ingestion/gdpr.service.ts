import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, inArray, or } from "drizzle-orm";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { stores } from "../../database/schema/stores";
import { customers, orders, products } from "../../database/schema/sales";

type Json = Record<string, unknown>;

/**
 * Faz 9 — Shopify GDPR zorunlu webhook'ları (veri silme/erişim).
 *  - `customers/redact`: bir müşterinin PII'ını sil (müşteri kaydı + siparişlerde e-posta).
 *  - `shop/redact`: uygulama kaldırıldıktan ~48s sonra mağazanın tüm PII verisini sil.
 *  - `customers/data_request`: erişim talebi — kayıt altına alınır (PII döndürülmez).
 *
 * Mağaza `shop_domain` ile çözülür (Shopify external_shop_id). Toplulaştırılmış
 * günlük metrikler PII içermediğinden korunur; ham satış/müşteri verisi silinir.
 */
@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private async storeIdForShop(shop: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: stores.id })
      .from(stores)
      .where(and(eq(stores.channel, "shopify"), eq(stores.externalShopId, shop)))
      .limit(1);
    return row?.id ?? null;
  }

  /** customers/redact — belirli müşterinin PII'ını siler. */
  async redactCustomer(shop: string, payload: Json): Promise<void> {
    const storeId = await this.storeIdForShop(shop);
    if (!storeId) {
      this.logger.warn(`GDPR customers/redact: mağaza bulunamadı (${shop})`);
      return;
    }
    const customer = (payload.customer ?? {}) as Json;
    const externalId = customer.id != null ? String(customer.id) : null;
    const email = typeof customer.email === "string" ? customer.email : null;

    // Müşteri kaydını sil
    if (externalId || email) {
      await this.db
        .delete(customers)
        .where(
          and(
            eq(customers.storeId, storeId),
            or(
              externalId ? eq(customers.externalId, externalId) : undefined,
              email ? eq(customers.email, email) : undefined,
            ),
          ),
        );
    }

    // Siparişlerdeki PII'ı anonimleştir (kâr metrikleri korunur, e-posta/kimlik silinir)
    const ordersToRedact = Array.isArray(payload.orders_to_redact)
      ? (payload.orders_to_redact as unknown[]).map(String)
      : [];
    const anonymize = { email: null, customerExternalId: null, updatedAt: new Date() };
    if (ordersToRedact.length > 0) {
      await this.db
        .update(orders)
        .set(anonymize)
        .where(
          and(
            eq(orders.storeId, storeId),
            inArray(orders.externalId, ordersToRedact),
          ),
        );
    } else if (externalId) {
      await this.db
        .update(orders)
        .set(anonymize)
        .where(
          and(
            eq(orders.storeId, storeId),
            eq(orders.customerExternalId, externalId),
          ),
        );
    }
    this.logger.log(`GDPR customers/redact tamamlandı (${shop})`);
  }

  /** shop/redact — mağazanın tüm ham satış/müşteri verisini siler. */
  async redactShop(shop: string): Promise<void> {
    const storeId = await this.storeIdForShop(shop);
    if (!storeId) {
      this.logger.warn(`GDPR shop/redact: mağaza bulunamadı (${shop})`);
      return;
    }
    // Cascade: orders→(line_items, transactions, refunds), products→variants.
    await this.db.delete(orders).where(eq(orders.storeId, storeId));
    await this.db.delete(products).where(eq(products.storeId, storeId));
    await this.db.delete(customers).where(eq(customers.storeId, storeId));
    await this.db
      .update(stores)
      .set({ status: "disconnected", updatedAt: new Date() })
      .where(eq(stores.id, storeId));
    this.logger.log(`GDPR shop/redact tamamlandı — ham veri silindi (${shop})`);
  }

  /** customers/data_request — erişim talebini kaydeder (otomatik dışa aktarım yok). */
  async logDataRequest(shop: string, payload: Json): Promise<void> {
    const customer = (payload.customer ?? {}) as Json;
    this.logger.log(
      `GDPR customers/data_request alındı (${shop}) müşteri=${String(customer.id ?? "?")}`,
    );
  }
}
