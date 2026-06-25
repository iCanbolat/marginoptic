import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AdProvider, ProductAdLinkCreateInput } from "@churnify/shared";
import { ApiError } from "@/lib/errors";
import { productsApi } from "../api/products-api";
import { productKeys } from "./product-keys";

/** Bir ürünün mevcut reklam eşleştirmeleri. */
export function useProductLinks(
  storeId: string | null,
  productExternalId: string | null,
) {
  return useQuery({
    queryKey: productKeys.links(storeId ?? "", productExternalId ?? ""),
    queryFn: () => productsApi.links(storeId as string, productExternalId as string),
    enabled: !!storeId && !!productExternalId,
  });
}

/** Eşleştirilebilir reklam varlıkları (kampanya/adset/ad). */
export function useAdEntities(storeId: string | null, provider?: AdProvider) {
  return useQuery({
    queryKey: productKeys.adEntities(storeId ?? "", provider),
    queryFn: () => productsApi.adEntities(storeId as string, provider),
    enabled: !!storeId,
  });
}

/** Eşleştirme oluştur/sil (sonrası ürün atfı yeniden hesaplanır). */
export function useProductLinkMutations(storeId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: productKeys.all });
  };

  const create = useMutation({
    mutationFn: (input: ProductAdLinkCreateInput) =>
      productsApi.createLink(storeId as string, input),
    onSuccess: () => {
      toast.success("Eşleştirme kaydedildi — atıf yeniden hesaplanıyor");
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Eşleştirme başarısız"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => productsApi.deleteLink(storeId as string, id),
    onSuccess: () => {
      toast.success("Eşleştirme kaldırıldı");
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Silme başarısız"),
  });

  return { create, remove };
}
