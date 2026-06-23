import { useQuery } from "@tanstack/react-query";
import { costsApi } from "../api/costs-api";
import { costKeys } from "./cost-keys";

/** Mağaza listesi (aktif mağaza seçimi / fallback için). */
export function useStores() {
  return useQuery({
    queryKey: costKeys.stores(),
    queryFn: costsApi.listStores,
  });
}
