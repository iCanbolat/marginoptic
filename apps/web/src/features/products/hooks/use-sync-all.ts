import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/errors";
import { productsApi } from "../api/products-api";
import { productKeys } from "./product-keys";

/** Sync-all cooldown durumu (butonu doğru göstermek için). */
export function useSyncAllStatus() {
  return useQuery({
    queryKey: productKeys.syncAll(),
    queryFn: productsApi.syncAllStatus,
    staleTime: 0,
  });
}

/** Tüm sağlayıcılardan senkronu tetikler; cooldown'da ise uyarır. */
export function useSyncAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: productsApi.syncAll,
    onSuccess: (res) => {
      if (res.triggered) {
        const { salesConnections, adConnections, trafficStores } = res.queued;
        toast.success(
          `Senkron başlatıldı: ${salesConnections} kanal, ${adConnections} reklam, ${trafficStores} pazar yeri`,
        );
      } else {
        toast.info("Senkron için biraz beklemelisin (cooldown aktif)");
      }
      // Cooldown durumunu ve verileri tazele.
      void qc.invalidateQueries({ queryKey: productKeys.syncAll() });
      void qc.invalidateQueries({ queryKey: productKeys.all });
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Senkron başlatılamadı"),
  });
}
