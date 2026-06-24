import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { costsApi } from "../api/costs-api";
import { costKeys } from "./cost-keys";
import { errMsg } from "../utils/errors";
import type { ShippingRuleInput } from "../types/cost-types";

/** Kargo kuralları: liste sorgusu + ekle/sil mutasyonları. */
export function useShipping(storeId: string) {
  const qc = useQueryClient();
  const key = costKeys.shipping(storeId);
  const invalidate = () => void qc.invalidateQueries({ queryKey: key });

  const rulesQ = useQuery({
    queryKey: key,
    queryFn: () => costsApi.listShipping(storeId),
  });

  const create = useMutation({
    mutationFn: (input: ShippingRuleInput) =>
      costsApi.createShipping(storeId, input),
    onSuccess: () => {
      toast.success("Kargo kuralı eklendi");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, "Kural eklenemedi")),
  });

  const createBatch = useMutation({
    mutationFn: (inputs: ShippingRuleInput[]) =>
      costsApi.createShippingBatch(storeId, inputs),
    onSuccess: (rows) => {
      toast.success(`${rows.length} kargo kuralı eklendi`);
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, "Kurallar eklenemedi")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => costsApi.deleteShipping(storeId, id),
    onSuccess: () => {
      toast.success("Kural silindi");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, "Silinemedi")),
  });

  return { rulesQ, create, createBatch, remove };
}
