import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { expensesApi } from "../api/expenses-api";
import { costKeys } from "./cost-keys";
import { errMsg } from "../utils/errors";
import { todayIso } from "../utils/format";
import type {
  CustomExpenseInput,
  CustomExpenseSummary,
} from "../types/cost-types";

/** Özel giderler (org-scoped): liste + ekle/aç-kapa/yeniden-hesapla/sil. */
export function useExpenses() {
  const qc = useQueryClient();
  const key = costKeys.expenses();
  const invalidate = () => void qc.invalidateQueries({ queryKey: key });

  const expensesQ = useQuery({
    queryKey: key,
    queryFn: () => expensesApi.list(),
  });

  const create = useMutation({
    mutationFn: (input: CustomExpenseInput) => expensesApi.create(input),
    onSuccess: () => {
      toast.success("Gider eklendi (dağıtım hesaplanıyor)");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, "Gider eklenemedi")),
  });

  const toggle = useMutation({
    mutationFn: (e: CustomExpenseSummary) =>
      expensesApi.update(e.id, { active: !e.active }),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(errMsg(e, "Güncellenemedi")),
  });

  const recompute = useMutation({
    mutationFn: (e: CustomExpenseSummary) =>
      expensesApi.materialize(e.id, e.startDate, todayIso()),
    onSuccess: () => toast.success("Yeniden hesaplama kuyruğa alındı"),
    onError: (e) => toast.error(errMsg(e, "İşlem başarısız")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () => {
      toast.success("Gider silindi");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, "Silinemedi")),
  });

  return { expensesQ, create, toggle, recompute, remove };
}
