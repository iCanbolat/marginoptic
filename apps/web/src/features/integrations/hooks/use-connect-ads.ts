import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/errors";
import type { AdProvider } from "@churnify/shared";
import { integrationApi } from "../api/integration-api";
import { integrationKeys } from "./integration-keys";

interface AdInstallVars {
  provider: AdProvider;
  storeId: string;
}

interface AdDevConnectVars extends AdInstallVars {
  externalAccountId: string;
}

/** Reklam hesabı bağlama: OAuth install (yönlendirme) + dev-connect (DEV). */
export function useConnectAds() {
  const qc = useQueryClient();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: integrationKeys.overview() });
    void qc.invalidateQueries({ queryKey: integrationKeys.stores() });
  };

  const install = useMutation({
    mutationFn: ({ provider, storeId }: AdInstallVars) =>
      integrationApi.adInstall(provider, storeId),
    onSuccess: (res) => {
      window.location.href = res.url;
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Bağlantı başlatılamadı"),
  });

  const devConnect = useMutation({
    mutationFn: ({ provider, storeId, externalAccountId }: AdDevConnectVars) =>
      integrationApi.adDevConnect(provider, { storeId, externalAccountId }),
    onSuccess: () => {
      toast.success("Reklam hesabı bağlandı (dev)");
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Dev bağlantı başarısız"),
  });

  return { install, devConnect };
}
