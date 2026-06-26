export const QUEUE_SHOPIFY_SYNC = "shopify-sync";
export const QUEUE_EBAY_SYNC = "ebay-sync";
export const QUEUE_AMAZON_SYNC = "amazon-sync";
export const QUEUE_WEBHOOKS = "webhooks";
export const QUEUE_TOKEN_REFRESH = "token-refresh";

/**
 * Marketplace polling (eBay/Amazon): webhook yerine periyodik artımlı senkron.
 * Repeatable scheduler aktif bağlantıları tarayıp her biri için backfill kuyruğa alır.
 */
export const QUEUE_MARKETPLACE_POLL = "marketplace-poll";
export const MARKETPLACE_POLL_SCHEDULER = "marketplace-poll-scheduler";

export const SHOPIFY_SYNC_RESOURCES = [
  "products",
  "orders",
  "customers",
] as const;
export type ShopifySyncResource = (typeof SHOPIFY_SYNC_RESOURCES)[number];

/** eBay kaynakları aynı isimlerle eşlenir (inventory→products, orders→orders, buyers→customers). */
export const EBAY_SYNC_RESOURCES = SHOPIFY_SYNC_RESOURCES;
export type EbaySyncResource = ShopifySyncResource;

export interface EbaySyncJob {
  connectionId: string;
  channelId: string;
  /** eBay satıcı kimliği (canlı fetch için); dev'de mağaza adı. */
  shopId: string;
  resource: EbaySyncResource;
  /** ISO; verilirse orders artımlı çekilir (polling watermark). */
  since?: string;
}

/** Amazon kaynakları aynı isimlerle eşlenir (listings→products, orders→orders, buyers→customers). */
export const AMAZON_SYNC_RESOURCES = SHOPIFY_SYNC_RESOURCES;
export type AmazonSyncResource = ShopifySyncResource;

export interface AmazonSyncJob {
  connectionId: string;
  channelId: string;
  /** Amazon marketplace/satıcı kimliği (canlı fetch için); dev'de satıcı adı. */
  shopId: string;
  resource: AmazonSyncResource;
  /** ISO; verilirse orders LastUpdatedAfter ile artımlı çekilir (polling watermark). */
  since?: string;
}

export type SyncStatusValue =
  | "idle"
  | "queued"
  | "running"
  | "done"
  | "error";

export interface ShopifySyncJob {
  connectionId: string;
  channelId: string;
  shop: string;
  resource: ShopifySyncResource;
}

export interface WebhookJob {
  provider: string;
  topic: string;
  shop: string;
  payload: unknown;
  /** `x-shopify-webhook-id` — Redis SETNX ile tekrarlı teslimat dedup'ı için. */
  eventId?: string;
}
