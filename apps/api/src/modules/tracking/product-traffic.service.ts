import { randomBytes } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { PixelEventInput, StoreTrackingInfo } from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { productProfitDaily } from "../../database/schema/metrics";
import { productTrafficDaily } from "../../database/schema/product-analytics";
import { channels } from "../../database/schema/channels";
import { assertStoreInOrg } from "../costs/store-access";
import { TRAFFIC_WINDOW_DAYS } from "./tracking.constants";

/** Shopify GID ("gid://shopify/Product/123") → dış kimlik ("123"). */
function gidToExternalId(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const seg = raw.split("/").pop() ?? raw;
  return seg.trim() || null;
}

/** Bugünün UTC tarihi (YYYY-MM-DD). */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayIso(offsetFromToday: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetFromToday);
  return d.toISOString().slice(0, 10);
}

/** Deterministik hash (ürün id + tarih → sayı). */
function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return h;
}

/**
 * Storefront dönüşüm izleme: Shopify snippet beacon'u + Amazon/eBay traffic.
 * `product_traffic_daily` (sessions/productViews/purchases) yazar; conversion
 * rate = purchases / sessions okuma katmanında türetilir
 */
@Injectable()
export class ProductTrafficService {
  private readonly logger = new Logger(ProductTrafficService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ---- Shopify Web Pixel olay alıcısı ----

  /**
   * Public pixel olayı: `accountId` (= store tracking key) ile mağazayı bul,
   * gün+ürün traffic sayaçlarını artır. Geçersiz/eşleşmeyen olaylar sessizce
   * yok sayılır (pixel yanıtı okumaz). Shopify ürün id'leri GID formatındadır.
   */
  async recordPixelEvent(payload: PixelEventInput): Promise<void> {
    const [store] = await this.db
      .select({ id: channels.id, channel: channels.channel })
      .from(channels)
      .where(eq(channels.trackingKey, payload.accountId))
      .limit(1);
    if (!store) return; // bilinmeyen Account ID → yok say

    const date = todayIso();
    const data = payload.data as Record<string, unknown>;

    if (payload.event === "product_viewed") {
      const pid = gidToExternalId(data.productId);
      if (!pid) return;
      await this.upsertTraffic({
        channelId: store.id,
        channel: store.channel,
        date,
        productExternalId: pid,
        sessions: 1,
        productViews: 1,
        purchases: 0,
      });
      return;
    }

    // checkout_completed: siparişteki her tekil ürün için bir dönüşüm say.
    const items = Array.isArray(data.items) ? (data.items as unknown[]) : [];
    const seen = new Set<string>();
    for (const it of items) {
      const pid = gidToExternalId((it as Record<string, unknown>)?.productId);
      if (!pid || seen.has(pid)) continue;
      seen.add(pid);
      await this.upsertTraffic({
        channelId: store.id,
        channel: store.channel,
        date,
        productExternalId: pid,
        sessions: 0,
        productViews: 0,
        purchases: 1,
      });
    }
  }

  // ---- Account ID (Web Pixel ayarı) ----

  /** Mağazanın Account ID'sini döndürür (yoksa üretip kaydeder). */
  async ensureTrackingInfo(
    storeId: string,
    channelId: string,
  ): Promise<StoreTrackingInfo> {
    await assertStoreInOrg(this.db, storeId, channelId);
    const [store] = await this.db
      .select({ trackingKey: channels.trackingKey })
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    let key = store?.trackingKey ?? null;
    if (!key) {
      key = randomBytes(16).toString("hex");
      await this.db
        .update(channels)
        .set({ trackingKey: key, updatedAt: new Date() })
        .where(eq(channels.id, channelId));
    }
    return { channelId, accountId: key };
  }

  // ---- Marketplace (Amazon/eBay) traffic ----

  /** Tüm aktif Amazon/eBay mağazaları için traffic senkronla (günlük scheduler). */
  async syncAllMarketplaces(): Promise<number> {
    const rows = await this.db
      .select({ id: channels.id })
      .from(channels)
      .where(
        and(eq(channels.status, "active"), inArray(channels.channel, ["amazon", "ebay"])),
      );
    let n = 0;
    for (const s of rows) n += (await this.syncMarketplaceTraffic(s.id)) ? 1 : 0;
    return n;
  }

  /** Kimlikli tetik: org sahipliğini doğrula, traffic'i yenile. */
  async syncMarketplaceTrafficForOrg(
    storeId: string,
    channelId: string,
  ): Promise<boolean> {
    await assertStoreInOrg(this.db, storeId, channelId);
    return this.syncMarketplaceTraffic(channelId);
  }

  /**
   * Bir Amazon/eBay mağazasının ürün-traffic'ini yeniler. Dev/sentetik: mağazanın
   * gerçek ürün dış kimlikleri üzerinden deterministik oturum/satış üretir (canlı
   * ortamda kanal traffic API'sinden çekilir). Shopify burada işlenmez.
   */
  async syncMarketplaceTraffic(channelId: string): Promise<boolean> {
    const [store] = await this.db
      .select({ channel: channels.channel })
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);
    if (!store || (store.channel !== "amazon" && store.channel !== "ebay")) {
      return false;
    }

    const productRows = await this.db
      .selectDistinct({ id: productProfitDaily.productExternalId })
      .from(productProfitDaily)
      .where(eq(productProfitDaily.channelId, channelId))
      .orderBy(productProfitDaily.productExternalId)
      .limit(20);
    const productIds = productRows
      .map((r) => r.id)
      .filter((id) => id && id !== "unknown");
    if (productIds.length === 0) return false;

    let wrote = 0;
    for (let d = 0; d < TRAFFIC_WINDOW_DAYS; d++) {
      const date = dayIso(-d);
      for (const pid of productIds) {
        const seed = hash(`${pid}:${date}`);
        const sessions = 20 + (seed % 80); // 20..99 oturum/gün
        // Dönüşüm oranı ~%1.5..%6 bandında deterministik.
        const rate = 0.015 + (seed % 45) / 1000;
        const purchases = Math.max(0, Math.round(sessions * rate));
        await this.upsertTraffic({
          channelId,
          channel: store.channel,
          date,
          productExternalId: pid,
          sessions,
          productViews: sessions,
          purchases,
          replace: true,
        });
        wrote += 1;
      }
    }
    this.logger.log(
      `Marketplace traffic ${store.channel} mağaza=${channelId}: ${wrote} ürün-gün`,
    );
    return wrote > 0;
  }

  // ---- ortak upsert ----

  /**
   * Gün+kanal+ürün traffic upsert'ü. `replace=false` (beacon) sayaçları artırır;
   * `replace=true` (marketplace senkron) idempotent olarak değeri set eder.
   */
  private async upsertTraffic(input: {
    channelId: string;
    channel: string;
    date: string;
    productExternalId: string;
    sessions: number;
    productViews: number;
    purchases: number;
    replace?: boolean;
  }): Promise<void> {
    const now = new Date();
    const setOnConflict = input.replace
      ? {
          sessions: input.sessions,
          productViews: input.productViews,
          purchases: input.purchases,
          updatedAt: now,
        }
      : {
          sessions: sql`${productTrafficDaily.sessions} + ${input.sessions}`,
          productViews: sql`${productTrafficDaily.productViews} + ${input.productViews}`,
          purchases: sql`${productTrafficDaily.purchases} + ${input.purchases}`,
          updatedAt: now,
        };
    await this.db
      .insert(productTrafficDaily)
      .values({
        channelId: input.channelId,
        date: input.date,
        productExternalId: input.productExternalId,
        channel: input.channel,
        sessions: input.sessions,
        productViews: input.productViews,
        purchases: input.purchases,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          productTrafficDaily.channelId,
          productTrafficDaily.channel,
          productTrafficDaily.productExternalId,
          productTrafficDaily.date,
        ],
        set: setOnConflict,
      });
  }
}
