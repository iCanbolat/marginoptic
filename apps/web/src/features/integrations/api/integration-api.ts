import type {
  AdConnectInput,
  AdProvider,
  IntegrationsOverview,
  ShopifyInstallResponse,
  ChannelSummary,
  StoreTrackingInfo,
} from "@churnify/shared";
import { apiDelete, apiGet, apiPost } from "@/lib/api-client";

/** Bağla/kaldır işlemlerinin döndürdüğü kimlikler. */
interface ConnectResult {
  storeId: string;
  connectionId: string;
}

/**
 * Integrations DAL — saf axios çağrıları (global `apiClient` örneği üzerinden).
 * UI bu modülü doğrudan çağırmaz; `hooks/` katmanı sarmalar.
 */
export const integrationApi = {
  overview: () => apiGet<IntegrationsOverview>("/integrations"),

  // Shopify
  shopifyInstall: (shop: string) =>
    apiGet<ShopifyInstallResponse>("/integrations/shopify/install", {
      params: { shop },
    }),
  shopifyDevConnect: (shop: string) =>
    apiPost<ConnectResult>("/integrations/shopify/dev-connect", { shop }),

  // eBay
  ebayInstall: () =>
    apiGet<ShopifyInstallResponse>("/integrations/ebay/install"),
  ebayDevConnect: (shop: string) =>
    apiPost<ConnectResult>("/integrations/ebay/dev-connect", { shop }),

  // Amazon
  amazonInstall: () =>
    apiGet<ShopifyInstallResponse>("/integrations/amazon/install"),
  amazonDevConnect: (shop: string) =>
    apiPost<ConnectResult>("/integrations/amazon/dev-connect", { shop }),

  // Reklam sağlayıcıları
  adInstall: (provider: AdProvider, storeId: string) =>
    apiGet<ShopifyInstallResponse>(`/integrations/ads/${provider}/install`, {
      params: { storeId },
    }),
  adDevConnect: (provider: AdProvider, input: AdConnectInput) =>
    apiPost<{ connectionId: string; provider: AdProvider }>(
      `/integrations/ads/${provider}/dev-connect`,
      input,
    ),

  // Bağlantı yönetimi
  disconnect: (connectionId: string) =>
    apiDelete<void>(`/integrations/${connectionId}`),

  // Reklam hesabı bağlama formu için mağaza listesi.
  listStores: () => apiGet<ChannelSummary[]>("/channels"),

  // Dönüşüm izleme (Web Pixel Account ID) — Shopify mağazası bazında.
  storeTracking: (storeId: string) =>
    apiGet<StoreTrackingInfo>(`/channels/${storeId}/tracking`),
};
