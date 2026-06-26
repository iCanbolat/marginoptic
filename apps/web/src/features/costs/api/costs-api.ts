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
  ChannelSummary,
  TaxConfigInput,
  TaxConfigSummary,
} from "../types/cost-types";

/** Costs DAL — saf axios çağrıları (mağaza-scoped maliyet kuralları). */
export const costsApi = {
  listStores: (): Promise<ChannelSummary[]> => apiGet<ChannelSummary[]>("/channels"),

  // COGS
  listCogs: (storeId: string): Promise<CogsRuleSummary[]> =>
    apiGet<CogsRuleSummary[]>(`/channels/${storeId}/costs/cogs`),
  createCogs: (storeId: string, input: CogsRuleInput): Promise<CogsRuleSummary> =>
    apiPost<CogsRuleSummary>(`/channels/${storeId}/costs/cogs`, input),
  createCogsBatch: (
    storeId: string,
    rules: CogsRuleInput[],
  ): Promise<CogsRuleSummary[]> =>
    apiPost<CogsRuleSummary[]>(`/channels/${storeId}/costs/cogs/batch`, { rules }),
  deleteCogs: (storeId: string, id: string): Promise<void> =>
    apiDelete(`/channels/${storeId}/costs/cogs/${id}`),
  importCogs: (
    storeId: string,
    input: CogsCsvImportInput,
  ): Promise<CogsCsvImportResult> =>
    apiPost<CogsCsvImportResult>(`/channels/${storeId}/costs/cogs/import`, input),

  // Kargo
  listShipping: (storeId: string): Promise<ShippingRuleSummary[]> =>
    apiGet<ShippingRuleSummary[]>(`/channels/${storeId}/costs/shipping`),
  createShipping: (
    storeId: string,
    input: ShippingRuleInput,
  ): Promise<ShippingRuleSummary> =>
    apiPost<ShippingRuleSummary>(`/channels/${storeId}/costs/shipping`, input),
  createShippingBatch: (
    storeId: string,
    rules: ShippingRuleInput[],
  ): Promise<ShippingRuleSummary[]> =>
    apiPost<ShippingRuleSummary[]>(`/channels/${storeId}/costs/shipping/batch`, {
      rules,
    }),
  deleteShipping: (storeId: string, id: string): Promise<void> =>
    apiDelete(`/channels/${storeId}/costs/shipping/${id}`),

  // Ödeme ücreti
  listPaymentFees: (storeId: string): Promise<PaymentFeeRuleSummary[]> =>
    apiGet<PaymentFeeRuleSummary[]>(`/channels/${storeId}/costs/payment-fees`),
  createPaymentFee: (
    storeId: string,
    input: PaymentFeeRuleInput,
  ): Promise<PaymentFeeRuleSummary> =>
    apiPost<PaymentFeeRuleSummary>(`/channels/${storeId}/costs/payment-fees`, input),
  deletePaymentFee: (storeId: string, id: string): Promise<void> =>
    apiDelete(`/channels/${storeId}/costs/payment-fees/${id}`),

  // Vergi
  getTax: (storeId: string): Promise<TaxConfigSummary> =>
    apiGet<TaxConfigSummary>(`/channels/${storeId}/costs/tax`),
  putTax: (storeId: string, input: TaxConfigInput): Promise<TaxConfigSummary> =>
    apiPut<TaxConfigSummary>(`/channels/${storeId}/costs/tax`, input),
};
