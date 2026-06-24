import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { costsApi } from "../api/costs-api";
import { costKeys } from "./cost-keys";
import { errMsg } from "../utils/errors";
import type { CogsRuleInput } from "../types/cost-types";

/** COGS kuralları: liste sorgusu + ekle/sil mutasyonları. */
export function useCogs(storeId: string) {
  const qc = useQueryClient();
  const key = costKeys.cogs(storeId);
  const invalidate = () => void qc.invalidateQueries({ queryKey: key });

  const rulesQ = useQuery({
    queryKey: key,
    queryFn: () => costsApi.listCogs(storeId),
  });

  const create = useMutation({
    mutationFn: (input: CogsRuleInput) => costsApi.createCogs(storeId, input),
    onSuccess: () => {
      toast.success("COGS kuralı eklendi");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, "Kural eklenemedi")),
  });

  const createBatch = useMutation({
    mutationFn: (inputs: CogsRuleInput[]) =>
      costsApi.createCogsBatch(storeId, inputs),
    onSuccess: (rows) => {
      toast.success(`${rows.length} COGS kuralı eklendi`);
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, "Kurallar eklenemedi")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => costsApi.deleteCogs(storeId, id),
    onSuccess: () => {
      toast.success("Kural silindi");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, "Silinemedi")),
  });

  return { rulesQ, create, createBatch, remove, invalidate };
}
