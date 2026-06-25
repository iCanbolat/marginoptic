import type { ProductAnalyticsChannel, ProductMappingStatus } from "@churnify/shared";

// Shared sözleşmeleri feature içi tek import noktası olarak yeniden ihraç et.
export type {
  AdEntityOption,
  ProductAdLink,
  ProductAdLinkCreateInput,
  ProductAnalyticsChannel,
  ProductAnalyticsRow,
  ProductMappingStatus,
  ProductOverviewCard,
  ProductOverviewResponse,
  ProductTableResponse,
  ProductTableSort,
  StoreTrackingInfo,
  SyncAllResult,
  SyncAllStatus,
} from "@churnify/shared";

/** Kanal görüntü etiketleri (Etsy bu sayfada yok). */
export const CHANNEL_LABELS: Record<ProductAnalyticsChannel, string> = {
  shopify: "Shopify",
  amazon: "Amazon",
  ebay: "eBay",
};

/** Eşleştirme durumu rozet etiketleri. */
export const MAPPING_LABELS: Record<ProductMappingStatus, string> = {
  auto: "Otomatik",
  manual: "Manuel",
  none: "Yok",
};

/** Amazon/eBay ürünleri manuel eşleştirmeye uygun (kullanıcı isteği). */
export function isManualMappable(channel: ProductAnalyticsChannel): boolean {
  return channel === "amazon" || channel === "ebay";
}
