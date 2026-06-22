export const QUEUE_SHOPIFY_SYNC = "shopify-sync";
export const QUEUE_ETSY_SYNC = "etsy-sync";
export const QUEUE_WEBHOOKS = "webhooks";
export const QUEUE_TOKEN_REFRESH = "token-refresh";

export const SHOPIFY_SYNC_RESOURCES = [
  "products",
  "orders",
  "customers",
] as const;
export type ShopifySyncResource = (typeof SHOPIFY_SYNC_RESOURCES)[number];

/** Etsy kaynakları aynı isimlerle eşlenir (listings→products, receipts→orders, buyers→customers). */
export const ETSY_SYNC_RESOURCES = SHOPIFY_SYNC_RESOURCES;
export type EtsySyncResource = ShopifySyncResource;

export interface EtsySyncJob {
  connectionId: string;
  storeId: string;
  /** Etsy mağaza kimliği (canlı fetch için); dev'de mağaza adı. */
  shopId: string;
  resource: EtsySyncResource;
}

export type SyncStatusValue =
  | "idle"
  | "queued"
  | "running"
  | "done"
  | "error";

export interface ShopifySyncJob {
  connectionId: string;
  storeId: string;
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
