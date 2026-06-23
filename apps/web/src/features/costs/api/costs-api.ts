import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import type {
  CogsCsvImportInput,
  CogsCsvImportResult,
  CogsRuleInput,
  CogsRuleSummary,
  PaymentFeeRuleInput,
  PaymentFeeRuleSummary,
  ShippingRuleInput,
  ShippingRuleSummary,
  StoreSummary,
  TaxConfigInput,
  TaxConfigSummary,
} from "../types/cost-types";
import {
  MOCK_STORES,
  USE_MOCK_COSTS,
  mockCreateCogs,
  mockCreatePaymentFee,
  mockCreateShipping,
  mockDeleteCogs,
  mockDeletePaymentFee,
  mockDeleteShipping,
  mockGetTax,
  mockImportCogs,
  mockListCogs,
  mockListPaymentFees,
  mockListShipping,
  mockPutTax,
} from "../mocks/costs-mock";

const resolved = <T>(v: T): Promise<T> => Promise.resolve(v);

/**
 * Costs DAL — saf axios çağrıları (mağaza-scoped maliyet kuralları).
 * `VITE_MOCK_ORDERS=true` ise API yerine in-memory mock döner (bkz. `mocks/costs-mock.ts`).
 */
export const costsApi = {
  listStores: (): Promise<StoreSummary[]> =>
    USE_MOCK_COSTS ? resolved(MOCK_STORES) : apiGet<StoreSummary[]>("/stores"),

  // COGS
  listCogs: (storeId: string): Promise<CogsRuleSummary[]> =>
    USE_MOCK_COSTS
      ? resolved(mockListCogs(storeId))
      : apiGet<CogsRuleSummary[]>(`/stores/${storeId}/costs/cogs`),
  createCogs: (storeId: string, input: CogsRuleInput): Promise<CogsRuleSummary> =>
    USE_MOCK_COSTS
      ? resolved(mockCreateCogs(storeId, input))
      : apiPost<CogsRuleSummary>(`/stores/${storeId}/costs/cogs`, input),
  deleteCogs: (storeId: string, id: string): Promise<void> =>
    USE_MOCK_COSTS
      ? resolved(mockDeleteCogs(storeId, id))
      : apiDelete(`/stores/${storeId}/costs/cogs/${id}`),
  importCogs: (
    storeId: string,
    input: CogsCsvImportInput,
  ): Promise<CogsCsvImportResult> =>
    USE_MOCK_COSTS
      ? resolved(mockImportCogs(storeId, input))
      : apiPost<CogsCsvImportResult>(`/stores/${storeId}/costs/cogs/import`, input),

  // Kargo
  listShipping: (storeId: string): Promise<ShippingRuleSummary[]> =>
    USE_MOCK_COSTS
      ? resolved(mockListShipping(storeId))
      : apiGet<ShippingRuleSummary[]>(`/stores/${storeId}/costs/shipping`),
  createShipping: (
    storeId: string,
    input: ShippingRuleInput,
  ): Promise<ShippingRuleSummary> =>
    USE_MOCK_COSTS
      ? resolved(mockCreateShipping(storeId, input))
      : apiPost<ShippingRuleSummary>(`/stores/${storeId}/costs/shipping`, input),
  deleteShipping: (storeId: string, id: string): Promise<void> =>
    USE_MOCK_COSTS
      ? resolved(mockDeleteShipping(storeId, id))
      : apiDelete(`/stores/${storeId}/costs/shipping/${id}`),

  // Ödeme ücreti
  listPaymentFees: (storeId: string): Promise<PaymentFeeRuleSummary[]> =>
    USE_MOCK_COSTS
      ? resolved(mockListPaymentFees(storeId))
      : apiGet<PaymentFeeRuleSummary[]>(`/stores/${storeId}/costs/payment-fees`),
  createPaymentFee: (
    storeId: string,
    input: PaymentFeeRuleInput,
  ): Promise<PaymentFeeRuleSummary> =>
    USE_MOCK_COSTS
      ? resolved(mockCreatePaymentFee(storeId, input))
      : apiPost<PaymentFeeRuleSummary>(
          `/stores/${storeId}/costs/payment-fees`,
          input,
        ),
  deletePaymentFee: (storeId: string, id: string): Promise<void> =>
    USE_MOCK_COSTS
      ? resolved(mockDeletePaymentFee(storeId, id))
      : apiDelete(`/stores/${storeId}/costs/payment-fees/${id}`),

  // Vergi
  getTax: (storeId: string): Promise<TaxConfigSummary> =>
    USE_MOCK_COSTS
      ? resolved(mockGetTax(storeId))
      : apiGet<TaxConfigSummary>(`/stores/${storeId}/costs/tax`),
  putTax: (storeId: string, input: TaxConfigInput): Promise<TaxConfigSummary> =>
    USE_MOCK_COSTS
      ? resolved(mockPutTax(storeId, input))
      : apiPut<TaxConfigSummary>(`/stores/${storeId}/costs/tax`, input),
};
