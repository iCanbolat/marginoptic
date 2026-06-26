import { apiGet } from "@/lib/api-client";
import type { AdsParams, AdsPerformanceResponse, ChannelSummary } from "../types/ad-types";

/** Ads DAL — saf axios çağrıları (mağaza-scoped reklam performansı). */
export const adsApi = {
  performance: (
    storeId: string,
    params: AdsParams,
  ): Promise<AdsPerformanceResponse> =>
    // axios `params`'taki undefined değerleri otomatik atar.
    apiGet<AdsPerformanceResponse>(`/channels/${storeId}/ads/performance`, {
      params: {
        from: params.from,
        to: params.to,
        level: params.level,
      },
    }),

  listStores: (): Promise<ChannelSummary[]> => apiGet<ChannelSummary[]>("/channels"),
};
