import { useQuery } from "@tanstack/react-query";
import { integrationApi } from "../api/integration-api";
import { integrationKeys } from "./integration-keys";

/** Reklam hesabı bağlama formu için mağaza listesi (GET /stores). */
export function useStores() {
  return useQuery({
    queryKey: integrationKeys.stores(),
    queryFn: integrationApi.listStores,
  });
}
