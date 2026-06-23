import { useQuery } from "@tanstack/react-query";
import { adsApi } from "../api/ads-api";
import { adKeys } from "./ad-keys";

/** Mağaza listesi (aktif mağaza seçimi / fallback için). */
export function useStores() {
  return useQuery({
    queryKey: adKeys.stores(),
    queryFn: adsApi.listStores,
  });
}
