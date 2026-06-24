import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/errors";
import { integrationApi } from "../api/integration-api";
import { integrationKeys } from "./integration-keys";

/** Amazon bağlama: OAuth install (yönlendirme) + dev-connect (DEV). */
export function useConnectAmazon() {
  const qc = useQueryClient();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: integrationKeys.overview() });
    void qc.invalidateQueries({ queryKey: integrationKeys.stores() });
  };

  const install = useMutation({
    mutationFn: () => integrationApi.amazonInstall(),
    onSuccess: (res) => {
      window.location.href = res.url;
    },
    onError: (e) =>
      toast.error(
        e instanceof ApiError ? e.message : "Amazon bağlantısı başlatılamadı",
      ),
  });

  const devConnect = useMutation({
    mutationFn: (shop: string) => integrationApi.amazonDevConnect(shop),
    onSuccess: () => {
      toast.success("Amazon mağazası bağlandı (dev)");
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Dev bağlantı başarısız"),
  });

  return { install, devConnect };
}
