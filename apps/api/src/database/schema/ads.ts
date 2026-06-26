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
import { integrationConnections, integrationProvider, channels } from "./channels";

/** Para alanları için ortak tip (sales/costs/metrics ile aynı): 20 basamak / 4 ondalık. */
const money = (name: string) => numeric(name, { precision: 20, scale: 4 });

/**
 * Faz 6 — Reklam entegrasyonları.
 * Reklam hiyerarşisi (`ad_entities`) + gün-bazlı harcama/metrik (`ad_spend`).
 * Harcama gün+mağaza seviyesinde blended olarak `daily_store_metrics.ad_spend`'e
 * (campaign seviyesi toplamı) katılır; ROAS/POAS okuma katmanında türetilir.
 */

/** Reklam hiyerarşi seviyesi (account > campaign > adset > ad). */
export const adLevel = pgEnum("ad_level", ["account", "campaign", "adset", "ad"]);

/** Reklam varlığı (kampanya/adset/ad); sağlayıcı id'siyle tekil. */
export const adEntities = pgTable(
  "ad_entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => integrationConnections.id, { onDelete: "cascade" }),
    provider: integrationProvider("provider").notNull(),
    level: adLevel("level").notNull(),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 500 }),
    // Üst varlık (adset→campaign, ad→adset); campaign için null.
    parentExternalId: varchar("parent_external_id", { length: 255 }),
    // Kırılım/gruplama kolaylığı: bu varlığın ait olduğu kampanya.
    campaignExternalId: varchar("campaign_external_id", { length: 255 }),
    status: varchar("status", { length: 32 }),
    currency: varchar("currency", { length: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_ad_entity_store_provider_external").on(
      t.channelId,
      t.provider,
      t.externalId,
    ),
    index("idx_ad_entity_store_level").on(t.channelId, t.provider, t.level),
  ],
);

/** Gün + varlık reklam harcaması/metrikleri (provider raporundan normalize). */
export const adSpend = pgTable(
  "ad_spend",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => integrationConnections.id, { onDelete: "cascade" }),
    provider: integrationProvider("provider").notNull(),
    date: date("date").notNull(),
    level: adLevel("level").notNull(),
    entityExternalId: varchar("entity_external_id", { length: 255 }).notNull(),
    campaignExternalId: varchar("campaign_external_id", { length: 255 }),
    name: varchar("name", { length: 500 }),
    spend: money("spend").notNull().default("0"),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    // Dönüşüm sayısı kesirli olabilir (Meta attribution) → numeric.
    conversions: numeric("conversions", { precision: 20, scale: 4 })
      .notNull()
      .default("0"),
    conversionValue: money("conversion_value").notNull().default("0"),
    currency: varchar("currency", { length: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_ad_spend_store_provider_entity_date").on(
      t.channelId,
      t.provider,
      t.entityExternalId,
      t.date,
    ),
    index("idx_ad_spend_store_date").on(t.channelId, t.date),
    index("idx_ad_spend_store_level_date").on(t.channelId, t.level, t.date),
  ],
);
