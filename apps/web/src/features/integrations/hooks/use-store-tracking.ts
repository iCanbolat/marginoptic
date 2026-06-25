import { useQuery } from "@tanstack/react-query";
import { integrationApi } from "../api/integration-api";
import { integrationKeys } from "./integration-keys";

/** Mağaza Web Pixel Account ID'si (pixel ayarına yapıştırılır; yoksa üretir). */
export function useStoreTracking(storeId: string | null, enabled = true) {
  return useQuery({
    queryKey: integrationKeys.tracking(storeId ?? ""),
    queryFn: () => integrationApi.storeTracking(storeId as string),
    enabled: !!storeId && enabled,
    staleTime: 5 * 60_000,
  });
}
