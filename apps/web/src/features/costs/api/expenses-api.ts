import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import type {
  CustomExpenseInput,
  CustomExpenseSummary,
  CustomExpenseUpdate,
} from "../types/cost-types";

/** Expenses DAL — org-scoped özel giderler (axios). */
export const expensesApi = {
  list: (storeId?: string): Promise<CustomExpenseSummary[]> =>
    apiGet<CustomExpenseSummary[]>("/costs/expenses", { params: { storeId } }),
  create: (input: CustomExpenseInput): Promise<CustomExpenseSummary> =>
    apiPost<CustomExpenseSummary>("/costs/expenses", input),
  update: (
    id: string,
    input: CustomExpenseUpdate,
  ): Promise<CustomExpenseSummary> =>
    apiPatch<CustomExpenseSummary>(`/costs/expenses/${id}`, input),
  remove: (id: string): Promise<void> =>
    apiDelete(`/costs/expenses/${id}`),
  materialize: (
    id: string,
    from: string,
    to: string,
  ): Promise<{ queued: true }> =>
    apiPost<{ queued: true }>(`/costs/expenses/${id}/materialize`, { from, to }),
};
