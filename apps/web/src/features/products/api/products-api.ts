import type {
  AdEntityOption,
  AdProvider,
  ProductAdLink,
  ProductAdLinkCreateInput,
  ProductOverviewResponse,
  ProductTableResponse,
  SyncAllResult,
  SyncAllStatus,
} from "@churnify/shared";
import { apiDelete, apiGet, apiPost } from "@/lib/api-client";
import type { AnalyticsFilterParams } from "@/lib/api";

/** Ürün tablosu sorgu paramları. */
export interface ProductTableParams extends AnalyticsFilterParams {
  page: number;
  pageSize: number;
  sort: string;
  search?: string;
  channel?: string;
}

function analyticsQs(
  f: AnalyticsFilterParams,
  extra?: Record<string, string | number | undefined>,
): string {
  const qs = new URLSearchParams({ from: f.from, to: f.to });
  if (f.storeIds && f.storeIds.length > 0) qs.set("storeIds", f.storeIds.join(","));
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v != null && v !== "") qs.set(k, String(v));
    }
  }
  return qs.toString();
}

/**
 * Ürün Analizi DAL — saf axios çağrıları (global `apiClient`). UI doğrudan
 * çağırmaz; `hooks/` katmanı React Query ile sarmalar.
 */
export const productsApi = {
  overview: (f: AnalyticsFilterParams) =>
    apiGet<ProductOverviewResponse>(
      `/analytics/product-overview?${analyticsQs(f)}`,
    ),

  table: (p: ProductTableParams) =>
    apiGet<ProductTableResponse>(
      `/analytics/product-table?${analyticsQs(p, {
        page: p.page,
        pageSize: p.pageSize,
        sort: p.sort,
        search: p.search,
        channel: p.channel,
      })}`,
    ),

  // Manuel eşleştirme
  links: (storeId: string, productExternalId: string) =>
    apiGet<ProductAdLink[]>(
      `/channels/${storeId}/product-ad-links?productExternalId=${encodeURIComponent(productExternalId)}`,
    ),
  adEntities: (storeId: string, provider?: AdProvider) =>
    apiGet<AdEntityOption[]>(
      `/channels/${storeId}/product-ad-links/ad-entities${provider ? `?provider=${provider}` : ""}`,
    ),
  createLink: (storeId: string, input: ProductAdLinkCreateInput) =>
    apiPost<ProductAdLink>(`/channels/${storeId}/product-ad-links`, input),
  deleteLink: (storeId: string, id: string) =>
    apiDelete<void>(`/channels/${storeId}/product-ad-links/${id}`),

  // Tüm sağlayıcılardan senkron (tek buton + cooldown)
  syncAllStatus: () => apiGet<SyncAllStatus>("/integrations/sync-all"),
  syncAll: () => apiPost<SyncAllResult>("/integrations/sync-all"),
};
