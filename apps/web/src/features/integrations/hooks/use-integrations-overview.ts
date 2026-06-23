import { useQuery } from "@tanstack/react-query";
import { integrationApi } from "../api/integration-api";
import { integrationKeys } from "./integration-keys";

/** Sağlayıcılar + aktif bağlantılar (GET /integrations). */
export function useIntegrationsOverview() {
  return useQuery({
    queryKey: integrationKeys.overview(),
    queryFn: integrationApi.overview,
  });
}
