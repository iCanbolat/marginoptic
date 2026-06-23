import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { adsApi } from "../api/ads-api";
import { adKeys } from "./ad-keys";
import type { AdsParams } from "../types/ad-types";

/**
 * Reklam performansı sorgusu (özet + kırılım + günlük seri).
 * `adsApi` üzerinden gider (mock modunda sahte veri, aksi halde axios istemcisi).
 */
export function useAdsPerformance(storeId: string | null, params: AdsParams) {
  return useQuery({
    queryKey: adKeys.performance(storeId, params),
    queryFn: () => adsApi.performance(storeId as string, params),
    enabled: storeId != null,
    placeholderData: keepPreviousData,
  });
}
