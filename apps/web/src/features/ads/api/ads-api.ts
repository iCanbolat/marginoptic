import { apiGet } from "@/lib/api-client";
import type { AdsParams, AdsPerformanceResponse, StoreSummary } from "../types/ad-types";
import { MOCK_STORES, USE_MOCK_ADS, mockAdsPerformance } from "../mocks/ads-mock";

/**
 * Ads DAL — saf axios çağrıları. `VITE_MOCK_ORDERS=true` ise API yerine
 * mock veri döner (bkz. `mocks/ads-mock.ts`).
 */
export const adsApi = {
  performance: (
    storeId: string,
    params: AdsParams,
  ): Promise<AdsPerformanceResponse> => {
    if (USE_MOCK_ADS) return Promise.resolve(mockAdsPerformance(storeId, params));
    // axios `params`'taki undefined değerleri otomatik atar.
    return apiGet<AdsPerformanceResponse>(`/stores/${storeId}/ads/performance`, {
      params: {
        from: params.from,
        to: params.to,
        level: params.level,
      },
    });
  },

  listStores: (): Promise<StoreSummary[]> => {
    if (USE_MOCK_ADS) return Promise.resolve(MOCK_STORES);
    return apiGet<StoreSummary[]>("/stores");
  },
};
