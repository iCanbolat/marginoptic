import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/errors";
import { integrationApi } from "../api/integration-api";
import { integrationKeys } from "./integration-keys";

/** Bağlantı kaldırma (DELETE /integrations/:id). */
export function useDisconnect() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (connectionId: string) =>
      integrationApi.disconnect(connectionId),
    onSuccess: () => {
      toast.success("Bağlantı kaldırıldı");
      void qc.invalidateQueries({ queryKey: integrationKeys.overview() });
      void qc.invalidateQueries({ queryKey: integrationKeys.stores() });
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Kaldırma başarısız"),
  });
}
