import {
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { adLevel } from "./ads";
import { integrationProvider, stores } from "./stores";

/** Para alanları için ortak tip (sales/costs/metrics/ads ile aynı): 20/4. */
const money = (name: string) => numeric(name, { precision: 20, scale: 4 });

/**
 * Ürün Analizi — ürün-bazlı reklam atfı + dönüşüm izleme tabloları.
 * `product_ad_links`: kampanya↔ürün eşleştirme (otomatik/manuel).
 * `product_ad_spend_daily`: ürün-seviyesi reklam harcaması (rollup'ı besler).
 * `product_traffic_daily`: ürün-seviyesi oturum/dönüşüm (conversion rate).
 */

/** Eşleştirme kaynağı: connector raporundan otomatik mi, kullanıcı manuel mi. */
export const adLinkMatchType = pgEnum("ad_link_match_type", ["auto", "manual"]);

/** Bir reklam varlığının (kampanya/adset/ad) bir ürüne eşleştirilmesi. */
export const productAdLinks = pgTable(
  "product_ad_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    productExternalId: varchar("product_external_id", { length: 255 }).notNull(),
    provider: integrationProvider("provider").notNull(),
    adEntityExternalId: varchar("ad_entity_external_id", {
      length: 255,
    }).notNull(),
    level: adLevel("level").notNull().default("campaign"),
    matchType: adLinkMatchType("match_type").notNull().default("manual"),
    // Bağlı varlığın harcamasının bu ürüne düşen ağırlığı (varsayılan 1).
    weight: money("weight").notNull().default("1"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_product_ad_link").on(
      t.storeId,
      t.productExternalId,
      t.provider,
      t.adEntityExternalId,
    ),
    index("idx_product_ad_link_entity").on(
      t.storeId,
      t.provider,
      t.adEntityExternalId,
    ),
    index("idx_product_ad_link_product").on(t.storeId, t.productExternalId),
  ],
);

/** Gün + ürün + sağlayıcı reklam harcaması (ürün-seviyesi atıf kaynağı). */
export const productAdSpendDaily = pgTable(
  "product_ad_spend_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    productExternalId: varchar("product_external_id", { length: 255 }).notNull(),
    provider: integrationProvider("provider").notNull(),
    spend: money("spend").notNull().default("0"),
    clicks: integer("clicks").notNull().default(0),
    conversions: numeric("conversions", { precision: 20, scale: 4 })
      .notNull()
      .default("0"),
    conversionValue: money("conversion_value").notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_product_ad_spend").on(
      t.storeId,
      t.provider,
      t.productExternalId,
      t.date,
    ),
    index("idx_product_ad_spend_store_date").on(t.storeId, t.date),
  ],
);

/** Gün + ürün oturum/görüntülenme/satış (dönüşüm oranı için). */
export const productTrafficDaily = pgTable(
  "product_traffic_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    productExternalId: varchar("product_external_id", { length: 255 }).notNull(),
    // Kaynak satış kanalı (shopify/amazon/ebay) — Etsy yok.
    channel: varchar("channel", { length: 32 }).notNull(),
    sessions: integer("sessions").notNull().default(0),
    productViews: integer("product_views").notNull().default(0),
    purchases: integer("purchases").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_product_traffic").on(
      t.storeId,
      t.channel,
      t.productExternalId,
      t.date,
    ),
    index("idx_product_traffic_store_date").on(t.storeId, t.date),
  ],
);
