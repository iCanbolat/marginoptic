import { z } from "zod";

export const INTEGRATION_PROVIDERS = [
  "shopify",
  "ebay",
  "amazon",
  "meta_ads",
  "google_ads",
  "tiktok_ads",
  "amazon_ads",
  "ebay_ads",
] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const SALES_CHANNELS = ["shopify", "ebay", "amazon"] as const;
export type SalesChannel = (typeof SALES_CHANNELS)[number];

export const CONNECTION_STATUSES = [
  "pending",
  "active",
  "error",
  "disconnected",
] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

/** myshopify.com mağaza alan adı doğrulaması. */
export const shopifyInstallSchema = z.object({
  shop: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/,
      "Geçerli bir *.myshopify.com alan adı girin",
    ),
});
export type ShopifyInstallInput = z.infer<typeof shopifyInstallSchema>;

/** eBay bağlama: mağaza adı/etiketi (OAuth canlıda eBay'den çözülür; dev'de bu kullanılır). */
export const ebayConnectSchema = z.object({
  shop: z
    .string()
    .trim()
    .min(2, "Mağaza adı en az 2 karakter")
    .max(60)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/, "Harf, rakam, boşluk, tire/alt çizgi"),
});
export type EbayConnectInput = z.infer<typeof ebayConnectSchema>;

/** Amazon bağlama: satıcı adı/etiketi (OAuth canlıda LWA'dan çözülür; dev'de bu kullanılır). */
export const amazonConnectSchema = z.object({
  shop: z
    .string()
    .trim()
    .min(2, "Satıcı adı en az 2 karakter")
    .max(60)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/, "Harf, rakam, boşluk, tire/alt çizgi"),
});
export type AmazonConnectInput = z.infer<typeof amazonConnectSchema>;

// ---- response sözleşmeleri ----

export interface ChannelSummary {
  id: string;
  channel: SalesChannel;
  name: string;
  externalShopId: string;
  domain: string | null;
  currency: string;
  status: ConnectionStatus;
}

export interface ConnectionSummary {
  id: string;
  provider: IntegrationProvider;
  status: ConnectionStatus;
  channelId: string | null;
  externalAccountId: string | null;
  scopes: string | null;
  createdAt: string;
}

export interface ProviderInfo {
  provider: IntegrationProvider;
  label: string;
  kind: "channel" | "ads";
  connectable: boolean;
}

export interface IntegrationsOverview {
  providers: ProviderInfo[];
  connections: ConnectionSummary[];
}

export interface ShopifyInstallResponse {
  url: string;
}
