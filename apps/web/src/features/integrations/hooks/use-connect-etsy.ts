import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/errors";
import { integrationApi } from "../api/integration-api";
import { integrationKeys } from "./integration-keys";

/** Etsy bağlama: OAuth install (PKCE yönlendirme) + dev-connect (DEV). */
export function useConnectEtsy() {
  const qc = useQueryClient();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: integrationKeys.overview() });
    void qc.invalidateQueries({ queryKey: integrationKeys.stores() });
  };

  const install = useMutation({
    mutationFn: () => integrationApi.etsyInstall(),
    onSuccess: (res) => {
      window.location.href = res.url;
    },
    onError: (e) =>
      toast.error(
        e instanceof ApiError ? e.message : "Etsy bağlantısı başlatılamadı",
      ),
  });

  const devConnect = useMutation({
    mutationFn: (shop: string) => integrationApi.etsyDevConnect(shop),
    onSuccess: () => {
      toast.success("Etsy mağazası bağlandı (dev)");
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Dev bağlantı başarısız"),
  });

  return { install, devConnect };
}
