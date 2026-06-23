import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import type {
  CustomExpenseInput,
  CustomExpenseSummary,
  CustomExpenseUpdate,
} from "../types/cost-types";
import {
  USE_MOCK_COSTS,
  mockCreateExpense,
  mockDeleteExpense,
  mockListExpenses,
  mockMaterializeExpense,
  mockUpdateExpense,
} from "../mocks/costs-mock";

const resolved = <T>(v: T): Promise<T> => Promise.resolve(v);

/**
 * Expenses DAL — org-scoped özel giderler (axios). `VITE_MOCK_ORDERS=true` ise
 * in-memory mock döner (bkz. `mocks/costs-mock.ts`).
 */
export const expensesApi = {
  list: (storeId?: string): Promise<CustomExpenseSummary[]> =>
    USE_MOCK_COSTS
      ? resolved(mockListExpenses(storeId))
      : apiGet<CustomExpenseSummary[]>("/costs/expenses", {
          params: { storeId },
        }),
  create: (input: CustomExpenseInput): Promise<CustomExpenseSummary> =>
    USE_MOCK_COSTS
      ? resolved(mockCreateExpense(input))
      : apiPost<CustomExpenseSummary>("/costs/expenses", input),
  update: (
    id: string,
    input: CustomExpenseUpdate,
  ): Promise<CustomExpenseSummary> =>
    USE_MOCK_COSTS
      ? resolved(mockUpdateExpense(id, input))
      : apiPatch<CustomExpenseSummary>(`/costs/expenses/${id}`, input),
  remove: (id: string): Promise<void> =>
    USE_MOCK_COSTS
      ? resolved(mockDeleteExpense(id))
      : apiDelete(`/costs/expenses/${id}`),
  materialize: (
    id: string,
    from: string,
    to: string,
  ): Promise<{ queued: true }> =>
    USE_MOCK_COSTS
      ? resolved(mockMaterializeExpense())
      : apiPost<{ queued: true }>(`/costs/expenses/${id}/materialize`, { from, to }),
};
