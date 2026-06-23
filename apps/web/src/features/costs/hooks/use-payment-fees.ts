import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { costsApi } from "../api/costs-api";
import { costKeys } from "./cost-keys";
import { errMsg } from "../utils/errors";
import type { PaymentFeeRuleInput } from "../types/cost-types";

/** Ödeme/işlem ücretleri: liste sorgusu + ekle/sil mutasyonları. */
export function usePaymentFees(storeId: string) {
  const qc = useQueryClient();
  const key = costKeys.paymentFees(storeId);
  const invalidate = () => void qc.invalidateQueries({ queryKey: key });

  const feesQ = useQuery({
    queryKey: key,
    queryFn: () => costsApi.listPaymentFees(storeId),
  });

  const create = useMutation({
    mutationFn: (input: PaymentFeeRuleInput) =>
      costsApi.createPaymentFee(storeId, input),
    onSuccess: () => {
      toast.success("Ödeme ücreti eklendi");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, "Eklenemedi")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => costsApi.deletePaymentFee(storeId, id),
    onSuccess: () => {
      toast.success("Silindi");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, "Silinemedi")),
  });

  return { feesQ, create, remove };
}
