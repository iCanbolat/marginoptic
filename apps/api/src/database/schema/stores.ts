import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "./auth";

export const salesChannel = pgEnum("sales_channel", [
  "shopify",
  "etsy",
  "ebay",
  "amazon",
]);

export const integrationProvider = pgEnum("integration_provider", [
  "shopify",
  "etsy",
  "ebay",
  "amazon",
  "meta_ads",
  "google_ads",
  "tiktok_ads",
  "amazon_ads",
  "ebay_ads",
]);

export const connectionStatus = pgEnum("connection_status", [
  "pending",
  "active",
  "error",
  "disconnected",
]);

export const syncStatus = pgEnum("sync_status", [
  "idle",
  "queued",
  "running",
  "done",
  "error",
]);

/** Satış kanalı mağazası (Shopify/Etsy). */
export const stores = pgTable(
  "stores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    channel: salesChannel("channel").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    // Shopify için "x.myshopify.com", Etsy için shop_id
    externalShopId: varchar("external_shop_id", { length: 255 }).notNull(),
    domain: varchar("domain", { length: 255 }),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
    status: connectionStatus("status").notNull().default("active"),
    // Storefront dönüşüm beacon'u (Shopify snippet) için public yazma anahtarı.
    // Mağaza oluşturulurken üretilir; snippet'e gömülür, /track ucunda doğrulanır.
    trackingKey: varchar("tracking_key", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_store_org_channel_external").on(
      t.organizationId,
      t.channel,
      t.externalShopId,
    ),
    index("idx_store_org").on(t.organizationId),
  ],
);

/** Bir provider'a (satış kanalı veya reklam) OAuth bağlantısı; token'lar şifreli. */
export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").references(() => stores.id, {
      onDelete: "set null",
    }),
    provider: integrationProvider("provider").notNull(),
    status: connectionStatus("status").notNull().default("pending"),
    accessTokenEnc: text("access_token_enc"),
    refreshTokenEnc: text("refresh_token_enc"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    scopes: text("scopes"),
    externalAccountId: varchar("external_account_id", { length: 255 }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_conn_org").on(t.organizationId),
    uniqueIndex("uq_conn_org_provider_account").on(
      t.organizationId,
      t.provider,
      t.externalAccountId,
    ),
  ],
);

/** Her bağlantı + kaynak (orders/products/customers) için artımlı sync durumu. */
export const syncState = pgTable(
  "sync_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => integrationConnections.id, { onDelete: "cascade" }),
    resource: varchar("resource", { length: 64 }).notNull(),
    cursor: text("cursor"),
    status: syncStatus("status").notNull().default("idle"),
    // İlerleme/özet sayaçları: { processed, total } gibi (UI ilerleme için).
    stats: jsonb("stats").notNull().default({}),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("uq_sync_conn_resource").on(t.connectionId, t.resource)],
);
