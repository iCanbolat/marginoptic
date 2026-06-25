import { z } from "zod";
import { AD_LEVELS, AD_PROVIDERS, type AdLevel, type AdProvider } from "./ads.js";

/**
 * Ürün Analizi sayfası DTO sözleşmesi (API ⇄ web ortak).
 * Overview kartları + ürün tablosu (ürün-bazlı ROAS / reklam harcaması /
 * dönüşüm) + manuel reklam eşleştirme. Para alanları DB'de `numeric` olduğundan
 * yanıtta ondalık string döner. Etsy bu sayfadan tamamen hariçtir.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-MM-DD biçiminde olmalı");

/** Bu sayfada gösterilen satış kanalları (Etsy hariç). */
export const PRODUCT_ANALYTICS_CHANNELS = [
  "shopify",
  "amazon",
  "ebay",
] as const;
export type ProductAnalyticsChannel =
  (typeof PRODUCT_ANALYTICS_CHANNELS)[number];

/** Bir ürünün reklam eşleştirme durumu (otomatik / manuel / yok). */
export const PRODUCT_MAPPING_STATUSES = ["auto", "manual", "none"] as const;
export type ProductMappingStatus = (typeof PRODUCT_MAPPING_STATUSES)[number];

// ---- Overview kartları ----

/** Tek bir overview kartının lider ürünü (+ ölçülen değer). */
export interface ProductOverviewCard {
  productExternalId: string | null;
  title: string | null;
  channel: ProductAnalyticsChannel | null;
  /** Karta özgü değer: units için sayı, diğerleri için ondalık string;
   * conversion için 0..1 oran string. value null = veri yok. */
  value: string | null;
  currency: string | null;
}

/** Overview: 3 platformdan beslenen 4 kart. */
export interface ProductOverviewResponse {
  from: string;
  to: string;
  storeIds: string[];
  currency: string;
  topByUnits: ProductOverviewCard;
  topByRevenue: ProductOverviewCard;
  topByNetProfit: ProductOverviewCard;
  /** Shopify (snippet) + Amazon/eBay (API traffic). Veri yoksa value=null. */
  topByConversionRate: ProductOverviewCard;
}

// ---- Ürün tablosu ----

export const PRODUCT_TABLE_SORTS = [
  "units",
  "revenue",
  "netProfit",
  "adSpend",
  "roas",
  "conversionRate",
] as const;
export type ProductTableSort = (typeof PRODUCT_TABLE_SORTS)[number];

/** Ürün tablosu satırı: kâr + ürün-bazlı ROAS/harcama + dönüşüm. */
export interface ProductAnalyticsRow {
  storeId: string;
  storeName: string;
  channel: ProductAnalyticsChannel;
  productExternalId: string;
  title: string | null;
  currency: string;
  units: number;
  revenue: string;
  cogs: string;
  adSpend: string;
  netProfit: string;
  /** revenue / adSpend; adSpend 0 ise null. */
  roas: number | null;
  /** purchases / sessions; sessions 0/yok ise null. */
  conversionRate: number | null;
  mappingStatus: ProductMappingStatus;
}

export interface ProductTableResponse {
  from: string;
  to: string;
  storeIds: string[];
  rows: ProductAnalyticsRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** Ürün tablosu sorgu paramları (analitik filtre + sayfalama + sıralama). */
export const productTableQuerySchema = z
  .object({
    from: isoDate,
    to: isoDate,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    sort: z.enum(PRODUCT_TABLE_SORTS).default("netProfit"),
    search: z.string().trim().max(255).optional(),
    channel: z.enum(PRODUCT_ANALYTICS_CHANNELS).optional(),
  })
  .refine((v) => v.to >= v.from, {
    message: "to, from'dan önce olamaz",
    path: ["to"],
  });
export type ProductTableQuery = z.infer<typeof productTableQuerySchema>;

// ---- Manuel reklam eşleştirme (product ↔ ad entity) ----

/** Reklam varlığı (eşleştirme UI'ında seçilebilir kampanya/adset/ad). */
export interface AdEntityOption {
  provider: AdProvider;
  level: AdLevel;
  externalId: string;
  campaignExternalId: string | null;
  name: string | null;
}

/** Mevcut bir ürün↔reklam eşleştirmesi. */
export interface ProductAdLink {
  id: string;
  storeId: string;
  productExternalId: string;
  provider: AdProvider;
  adEntityExternalId: string;
  level: AdLevel;
  matchType: "auto" | "manual";
  weight: string;
  createdAt: string;
}

/** Eşleştirme oluşturma girdisi. */
export const productAdLinkCreateSchema = z.object({
  productExternalId: z.string().trim().min(1).max(255),
  provider: z.enum(AD_PROVIDERS),
  adEntityExternalId: z.string().trim().min(1).max(255),
  level: z.enum(AD_LEVELS).default("campaign"),
  /** Bağlı varlığın harcamasının bu ürüne düşen ağırlığı (>0). */
  weight: z.coerce.number().positive().max(1000).default(1),
});
export type ProductAdLinkCreateInput = z.infer<
  typeof productAdLinkCreateSchema
>;

// ---- Shopify Web Pixel dönüşüm olayı ----

/** Web Pixel'in yayınladığı (subscribe ettiğimiz) olaylar. */
export const PIXEL_EVENTS = ["product_viewed", "checkout_completed"] as const;
export type PixelEvent = (typeof PIXEL_EVENTS)[number];

/**
 * Shopify Web Pixel → backend payload'ı. Pixel `browser.fetch` ile `text/plain`
 * (preflight'sız) gönderir; gövde JSON string olarak çözülür. `accountId` mağazanın
 * MarginOptic Account ID'sidir (= tracking key); `data` olay tipine göre değişir.
 */
export const pixelEventSchema = z.object({
  accountId: z.string().trim().min(8).max(128),
  shop: z.string().trim().max(255).optional(),
  event: z.enum(PIXEL_EVENTS),
  data: z.record(z.unknown()),
  timestamp: z.string().optional(),
});
export type PixelEventInput = z.infer<typeof pixelEventSchema>;

/** Mağaza dönüşüm izleme bilgisi (Web Pixel ayarına yapıştırılacak Account ID). */
export interface StoreTrackingInfo {
  storeId: string;
  /** Web Pixel'in "MarginOptic Account ID" ayarına girilecek değer. */
  accountId: string;
}

// ---- Tüm sağlayıcılardan senkron (tek buton + cooldown) ----

/** Sync-all cooldown durumu (sayfa ilk yüklemede butonu doğru göstermek için). */
export interface SyncAllStatus {
  onCooldown: boolean;
  /** Cooldown bitiş zamanı (ISO) — onCooldown false ise null. */
  nextAvailableAt: string | null;
  /** Cooldown toplam süresi (saniye). */
  cooldownSeconds: number;
}

/** Sync-all tetikleme sonucu. */
export interface SyncAllResult {
  /** Cooldown aktifse false (iş kuyruğa alınmadı). */
  triggered: boolean;
  nextAvailableAt: string;
  cooldownSeconds: number;
  /** Kuyruğa alınan iş sayıları (triggered=false ise hepsi 0). */
  queued: {
    salesConnections: number;
    adConnections: number;
    trafficStores: number;
  };
}
