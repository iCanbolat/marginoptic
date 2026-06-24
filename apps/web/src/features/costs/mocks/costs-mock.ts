import type {
  CogsCsvImportInput,
  CogsCsvImportResult,
  CogsRuleInput,
  CogsRuleSummary,
  CustomExpenseInput,
  CustomExpenseSummary,
  CustomExpenseUpdate,
  PaymentFeeRuleInput,
  PaymentFeeRuleSummary,
  ShippingRuleInput,
  ShippingRuleSummary,
  StoreSummary,
  TaxConfigInput,
  TaxConfigSummary,
} from "../types/cost-types";

/**
 * Mock veri anahtarı. Orders/ads feature'ları ile aynı `.env` bayrağını paylaşır:
 * `VITE_MOCK_ORDERS=true` yazıp dev server'ı yeniden başlatınca maliyet feature'ı
 * API yerine bu in-memory sahte veriyi kullanır — backend olmadan kural ekleme/
 * silme/CSV içe aktarma akışını test etmek için. CRUD oturum içinde kalıcıdır
 * (sayfa yenilenince sıfırlanır).
 */
export const USE_MOCK_COSTS = import.meta.env.VITE_MOCK_ORDERS === "true";

const STORE_ID = "00000000-0000-4000-8000-000000000001";
const ORG_ID = "00000000-0000-4000-8000-0000000000a1";

export const MOCK_STORES: StoreSummary[] = [
  {
    id: STORE_ID,
    channel: "shopify",
    name: "Mock Mağaza",
    externalShopId: "mock-shop",
    domain: "mock.myshopify.com",
    currency: "USD",
    status: "active",
  },
];

let seq = 100;
const nextId = (prefix: string): string => `mock-${prefix}-${++seq}`;
const now = (): string => new Date().toISOString();

// --- In-memory tablolar (storeId ile anahtarlı) ---

const cogsByStore = new Map<string, CogsRuleSummary[]>();
const shippingByStore = new Map<string, ShippingRuleSummary[]>();
const feesByStore = new Map<string, PaymentFeeRuleSummary[]>();
const taxByStore = new Map<string, TaxConfigSummary>();
let expenses: CustomExpenseSummary[] = [];

function seedStore(storeId: string): void {
  if (cogsByStore.has(storeId)) return;
  cogsByStore.set(storeId, [
    {
      id: nextId("cogs"),
      storeId,
      scope: "global",
      matchValue: null,
      country: null,
      minQty: 1,
      costAmount: "12.50",
      handlingFee: "1.00",
      currency: "USD",
      effectiveFrom: null,
      effectiveTo: null,
      source: "manual",
      updatedAt: now(),
    },
    {
      id: nextId("cogs"),
      storeId,
      scope: "sku",
      matchValue: "SKU-DEMO-1",
      country: "TR",
      minQty: 1,
      costAmount: "7.90",
      handlingFee: null,
      currency: "USD",
      effectiveFrom: null,
      effectiveTo: null,
      source: "csv",
      updatedAt: now(),
    },
  ]);
  shippingByStore.set(storeId, [
    {
      id: nextId("ship"),
      storeId,
      name: "Standart",
      country: null,
      minQty: null,
      maxQty: null,
      minWeightGrams: null,
      maxWeightGrams: null,
      baseCost: "4.99",
      perItemCost: "0.50",
      currency: "USD",
      effectiveFrom: null,
      effectiveTo: null,
      updatedAt: now(),
    },
  ]);
  feesByStore.set(storeId, [
    {
      id: nextId("fee"),
      storeId,
      gateway: "shopify_payments",
      percentage: "2.9",
      fixedFee: "0.30",
      currency: "USD",
      effectiveFrom: null,
      effectiveTo: null,
      updatedAt: now(),
    },
  ]);
  taxByStore.set(storeId, {
    storeId,
    salesTaxBorne: false,
    incomeTaxRate: null,
    updatedAt: now(),
  });
}

function seedExpenses(): void {
  if (expenses.length > 0) return;
  expenses = [
    {
      id: nextId("exp"),
      organizationId: ORG_ID,
      storeId: STORE_ID,
      name: "Kira",
      category: "Sabit gider",
      type: "recurring",
      recurrence: "monthly",
      allocation: "store",
      amount: "1500.00",
      currency: "USD",
      startDate: "2026-01-01",
      endDate: null,
      active: true,
      updatedAt: now(),
    },
  ];
}

// --- COGS ---

export function mockListCogs(storeId: string): CogsRuleSummary[] {
  seedStore(storeId);
  return cogsByStore.get(storeId) ?? [];
}

export function mockCreateCogs(
  storeId: string,
  input: CogsRuleInput,
): CogsRuleSummary {
  seedStore(storeId);
  const row: CogsRuleSummary = {
    id: nextId("cogs"),
    storeId,
    scope: input.scope,
    matchValue: input.matchValue ?? null,
    country: input.country ?? null,
    minQty: input.minQty ?? 1,
    costAmount: input.costAmount,
    handlingFee: input.handlingFee ?? null,
    currency: input.currency ?? "USD",
    effectiveFrom: input.effectiveFrom ?? null,
    effectiveTo: input.effectiveTo ?? null,
    source: "manual",
    updatedAt: now(),
  };
  cogsByStore.get(storeId)!.unshift(row);
  return row;
}

export function mockCreateCogsBatch(
  storeId: string,
  inputs: CogsRuleInput[],
): CogsRuleSummary[] {
  return inputs.map((input) => mockCreateCogs(storeId, input));
}

export function mockDeleteCogs(storeId: string, id: string): void {
  cogsByStore.set(
    storeId,
    (cogsByStore.get(storeId) ?? []).filter((r) => r.id !== id),
  );
}

export function mockImportCogs(
  storeId: string,
  input: CogsCsvImportInput,
): CogsCsvImportResult {
  seedStore(storeId);
  const lines = input.csv.trim().split(/\r?\n/);
  const body = lines.slice(1); // başlık satırını atla
  const rows = body.map((line, i) => {
    const [sku, cost, handling] = line.split(",").map((c) => c?.trim());
    const valid = Boolean(sku) && Boolean(cost) && !Number.isNaN(Number(cost));
    return {
      line: i + 2,
      sku: sku ?? null,
      costAmount: cost ?? null,
      handlingFee: handling ?? null,
      valid,
      error: valid ? null : "Geçersiz satır (sku/cost zorunlu)",
    };
  });
  const valid = rows.filter((r) => r.valid);
  if (!input.dryRun) {
    for (const r of valid) {
      mockCreateCogs(storeId, {
        scope: "sku",
        matchValue: r.sku!,
        costAmount: r.costAmount!,
        handlingFee: r.handlingFee || undefined,
        minQty: 1,
      });
    }
  }
  return {
    rows,
    total: rows.length,
    valid: valid.length,
    invalid: rows.length - valid.length,
    imported: input.dryRun ? 0 : valid.length,
    dryRun: input.dryRun ?? false,
  };
}

// --- Kargo ---

export function mockListShipping(storeId: string): ShippingRuleSummary[] {
  seedStore(storeId);
  return shippingByStore.get(storeId) ?? [];
}

export function mockCreateShipping(
  storeId: string,
  input: ShippingRuleInput,
): ShippingRuleSummary {
  seedStore(storeId);
  const row: ShippingRuleSummary = {
    id: nextId("ship"),
    storeId,
    name: input.name,
    country: input.country ?? null,
    minQty: input.minQty ?? null,
    maxQty: input.maxQty ?? null,
    minWeightGrams: input.minWeightGrams ?? null,
    maxWeightGrams: input.maxWeightGrams ?? null,
    baseCost: input.baseCost ?? "0",
    perItemCost: input.perItemCost ?? null,
    currency: input.currency ?? "USD",
    effectiveFrom: input.effectiveFrom ?? null,
    effectiveTo: input.effectiveTo ?? null,
    updatedAt: now(),
  };
  shippingByStore.get(storeId)!.unshift(row);
  return row;
}

export function mockCreateShippingBatch(
  storeId: string,
  inputs: ShippingRuleInput[],
): ShippingRuleSummary[] {
  return inputs.map((input) => mockCreateShipping(storeId, input));
}

export function mockDeleteShipping(storeId: string, id: string): void {
  shippingByStore.set(
    storeId,
    (shippingByStore.get(storeId) ?? []).filter((r) => r.id !== id),
  );
}

// --- Ödeme ücreti ---

export function mockListPaymentFees(storeId: string): PaymentFeeRuleSummary[] {
  seedStore(storeId);
  return feesByStore.get(storeId) ?? [];
}

export function mockCreatePaymentFee(
  storeId: string,
  input: PaymentFeeRuleInput,
): PaymentFeeRuleSummary {
  seedStore(storeId);
  const row: PaymentFeeRuleSummary = {
    id: nextId("fee"),
    storeId,
    gateway: input.gateway ?? null,
    percentage: input.percentage ?? "0",
    fixedFee: input.fixedFee ?? "0",
    currency: input.currency ?? "USD",
    effectiveFrom: input.effectiveFrom ?? null,
    effectiveTo: input.effectiveTo ?? null,
    updatedAt: now(),
  };
  feesByStore.get(storeId)!.unshift(row);
  return row;
}

export function mockDeletePaymentFee(storeId: string, id: string): void {
  feesByStore.set(
    storeId,
    (feesByStore.get(storeId) ?? []).filter((r) => r.id !== id),
  );
}

// --- Vergi ---

export function mockGetTax(storeId: string): TaxConfigSummary {
  seedStore(storeId);
  return taxByStore.get(storeId)!;
}

export function mockPutTax(
  storeId: string,
  input: TaxConfigInput,
): TaxConfigSummary {
  const next: TaxConfigSummary = {
    storeId,
    salesTaxBorne: input.salesTaxBorne ?? false,
    incomeTaxRate: input.incomeTaxRate ?? null,
    updatedAt: now(),
  };
  taxByStore.set(storeId, next);
  return next;
}

// --- Özel giderler (org-scoped) ---

export function mockListExpenses(storeId?: string): CustomExpenseSummary[] {
  seedExpenses();
  return storeId ? expenses.filter((e) => e.storeId === storeId) : expenses;
}

export function mockCreateExpense(
  input: CustomExpenseInput,
): CustomExpenseSummary {
  seedExpenses();
  const row: CustomExpenseSummary = {
    id: nextId("exp"),
    organizationId: ORG_ID,
    storeId: input.storeId ?? null,
    name: input.name,
    category: input.category ?? null,
    type: input.type,
    recurrence: input.recurrence ?? null,
    allocation: input.allocation ?? "store",
    amount: input.amount,
    currency: input.currency ?? "USD",
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    active: input.active ?? true,
    updatedAt: now(),
  };
  expenses.unshift(row);
  return row;
}

export function mockUpdateExpense(
  id: string,
  input: CustomExpenseUpdate,
): CustomExpenseSummary {
  const row = expenses.find((e) => e.id === id)!;
  if (input.active != null) row.active = input.active;
  if (input.name != null) row.name = input.name;
  if (input.amount != null) row.amount = input.amount;
  if (input.startDate != null) row.startDate = input.startDate;
  if (input.endDate !== undefined) row.endDate = input.endDate ?? null;
  row.updatedAt = now();
  return row;
}

export function mockDeleteExpense(id: string): void {
  expenses = expenses.filter((e) => e.id !== id);
}

export function mockMaterializeExpense(): { queued: true } {
  return { queued: true };
}
