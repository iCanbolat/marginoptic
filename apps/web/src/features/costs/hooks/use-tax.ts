import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { costsApi } from "../api/costs-api";
import { costKeys } from "./cost-keys";
import { errMsg } from "../utils/errors";
import type { TaxConfigInput } from "../types/cost-types";

/** Vergi ayarı: tekil config sorgusu + kaydet mutasyonu. */
export function useTax(storeId: string) {
  const qc = useQueryClient();
  const key = costKeys.tax(storeId);

  const taxQ = useQuery({
    queryKey: key,
    queryFn: () => costsApi.getTax(storeId),
  });

  const save = useMutation({
    mutationFn: (input: TaxConfigInput) => costsApi.putTax(storeId, input),
    onSuccess: () => {
      toast.success("Vergi ayarı kaydedildi");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(errMsg(e, "Kaydedilemedi")),
  });

  return { taxQ, save };
}
