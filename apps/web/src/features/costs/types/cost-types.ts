// Shared maliyet sözleşmelerini feature içi tek import noktası olarak yeniden ihraç et.
export {
  COGS_SCOPES,
  EXPENSE_ALLOCATIONS,
  EXPENSE_RECURRENCES,
  cogsRuleInputSchema,
  shippingRuleInputSchema,
  paymentFeeRuleInputSchema,
  taxConfigInputSchema,
  customExpenseInputSchema,
} from "@churnify/shared";
export type {
  CogsScope,
  CogsRuleInput,
  CogsRuleSummary,
  CogsCsvImportInput,
  CogsCsvImportResult,
  ShippingRuleInput,
  ShippingRuleSummary,
  PaymentFeeRuleInput,
  PaymentFeeRuleSummary,
  TaxConfigInput,
  TaxConfigSummary,
  CustomExpenseInput,
  CustomExpenseSummary,
  CustomExpenseUpdate,
  ExpenseAllocation,
  ExpenseRecurrence,
  ExpenseType,
  StoreSummary,
} from "@churnify/shared";

import type {
  CogsScope,
  ExpenseAllocation,
  ExpenseRecurrence,
} from "@churnify/shared";

/** COGS kapsam etiketleri (tek kaynak). */
export const SCOPE_LABELS: Record<CogsScope, string> = {
  sku: "SKU",
  variant: "Varyant",
  product: "Ürün",
  global: "Genel",
};

/** Gider sıklık etiketleri. */
export const RECURRENCE_LABELS: Record<ExpenseRecurrence, string> = {
  daily: "Günlük",
  weekly: "Haftalık",
  monthly: "Aylık",
};

/** Gider dağıtım etiketleri. */
export const ALLOCATION_LABELS: Record<ExpenseAllocation, string> = {
  store: "Tek mağaza",
  spread: "Mağazalara yay",
};
