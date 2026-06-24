import {
  AmazonIcon,
  AuctionIcon,
  GoogleIcon,
  MetaIcon,
  ShoppingBag01Icon,
  Store01Icon,
  TiktokIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type {
  AdProvider,
  IntegrationProvider,
} from "@churnify/shared";

// Shared sözleşmeleri buradan yeniden ihraç et — feature içi tek import noktası.
export type {
  AdProvider,
  ConnectionStatus,
  ConnectionSummary,
  IntegrationProvider,
  IntegrationsOverview,
  ProviderInfo,
  StoreSummary,
} from "@churnify/shared";

/** Sağlayıcı görüntüleme meta verisi (etiket + ikon). `kind` shared `ProviderInfo`'dan gelir. */
export interface ProviderMeta {
  label: string;
  icon: IconSvgElement;
}

export const PROVIDER_META: Record<IntegrationProvider, ProviderMeta> = {
  shopify: { label: "Shopify", icon: ShoppingBag01Icon },
  etsy: { label: "Etsy", icon: Store01Icon },
  ebay: { label: "eBay", icon: AuctionIcon },
  amazon: { label: "Amazon", icon: AmazonIcon },
  meta_ads: { label: "Meta Ads", icon: MetaIcon },
  google_ads: { label: "Google Ads", icon: GoogleIcon },
  tiktok_ads: { label: "TikTok Ads", icon: TiktokIcon },
};

/** Reklam sağlayıcı etiketleri (connect dialog select'i için). */
export const AD_LABELS: Record<AdProvider, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  tiktok_ads: "TikTok Ads",
};
