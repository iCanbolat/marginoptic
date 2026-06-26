import { z } from "zod";

/**
 * Faz 4 — Maliyet modelleme DTO sözleşmesi (API ⇄ web ortak).
 * Para alanları DB'de `numeric` olduğundan yanıtta string döner; girdide
 * sayı veya string kabul edip normalize edilmiş ondalık string'e çeviririz.
 */

// ---- ortak yardımcılar ----

/** Sayı | string kabul eder, finite & >= 0 ondalık string'e normalize eder. */
export const moneyInput = z
  .union([z.number(), z.string()])
  .transform((v, ctx) => {
    const n = typeof v === "string" ? Number(v.trim()) : v;
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Geçerli, negatif olmayan bir tutar girin",
      });
      return z.NEVER;
    }
    return n.toFixed(4);
  });

/** Yüzde 0..100 → normalize string. */
export const rateInput = z
  .union([z.number(), z.string()])
  .transform((v, ctx) => {
    const n = typeof v === "string" ? Number(v.trim()) : v;
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Oran 0 ile 100 arasında olmalı",
      });
      return z.NEVER;
    }
    return n.toFixed(4);
  });

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-MM-DD biçiminde olmalı");

const country = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "ISO-3166 alpha-2 ülke kodu girin");

const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "ISO-4217 para kodu girin");

// ---- COGS ----

export const COGS_SCOPES = ["sku", "variant", "product", "global"] as const;
export type CogsScope = (typeof COGS_SCOPES)[number];

export const cogsRuleInputSchema = z
  .object({
    scope: z.enum(COGS_SCOPES),
    matchValue: z.string().trim().min(1).max(255).optional(),
    country: country.optional(),
    minQty: z.coerce.number().int().min(1).default(1),
    costAmount: moneyInput,
    handlingFee: moneyInput.optional(),
    currency: currency.optional(),
    effectiveFrom: z.string().datetime().optional(),
    effectiveTo: z.string().datetime().optional(),
  })
  .refine((v) => v.scope === "global" || !!v.matchValue, {
    message: "global dışındaki kapsamlar için matchValue zorunlu",
    path: ["matchValue"],
  });
export type CogsRuleInput = z.infer<typeof cogsRuleInputSchema>;

/** Toplu COGS kuralı ekleme: UI'da stack'lenip tek istekte gönderilir. */
export const cogsRuleBatchInputSchema = z.object({
  rules: z
    .array(cogsRuleInputSchema)
    .min(1, "En az bir kural ekleyin")
    .max(200, "Tek seferde en fazla 200 kural"),
});
export type CogsRuleBatchInput = z.infer<typeof cogsRuleBatchInputSchema>;

export const cogsRuleUpdateSchema = z.object({
  matchValue: z.string().trim().min(1).max(255).nullish(),
  country: country.nullish(),
  minQty: z.coerce.number().int().min(1).optional(),
  costAmount: moneyInput.optional(),
  handlingFee: moneyInput.nullish(),
  currency: currency.nullish(),
  effectiveFrom: z.string().datetime().nullish(),
  effectiveTo: z.string().datetime().nullish(),
});
export type CogsRuleUpdate = z.infer<typeof cogsRuleUpdateSchema>;

export interface CogsRuleSummary {
  id: string;
  channelId: string;
  scope: CogsScope;
  matchValue: string | null;
  country: string | null;
  minQty: number;
  costAmount: string;
  handlingFee: string | null;
  currency: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  source: string;
  updatedAt: string;
}

/** COGS CSV import: ham metin + dry-run önizleme bayrağı. */
export const cogsCsvImportSchema = z.object({
  csv: z.string().min(1, "CSV içeriği boş olamaz").max(2_000_000),
  dryRun: z.coerce.boolean().default(false),
});
export type CogsCsvImportInput = z.infer<typeof cogsCsvImportSchema>;

export interface CogsCsvRowResult {
  line: number;
  sku: string | null;
  costAmount: string | null;
  handlingFee: string | null;
  valid: boolean;
  error: string | null;
}

export interface CogsCsvImportResult {
  rows: CogsCsvRowResult[];
  total: number;
  valid: number;
  invalid: number;
  /** dryRun=false ise yazılan/güncellenen kural sayısı; dryRun ise 0. */
  imported: number;
  dryRun: boolean;
}

// ---- Kargo ----

export const shippingRuleInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    country: country.optional(),
    minQty: z.coerce.number().int().min(0).optional(),
    maxQty: z.coerce.number().int().min(0).optional(),
    minWeightGrams: z.coerce.number().int().min(0).optional(),
    maxWeightGrams: z.coerce.number().int().min(0).optional(),
    baseCost: moneyInput.default("0"),
    perItemCost: moneyInput.optional(),
    currency: currency.optional(),
    effectiveFrom: z.string().datetime().optional(),
    effectiveTo: z.string().datetime().optional(),
  })
  .refine((v) => v.maxQty == null || v.minQty == null || v.maxQty >= v.minQty, {
    message: "maxQty, minQty'den küçük olamaz",
    path: ["maxQty"],
  });
export type ShippingRuleInput = z.infer<typeof shippingRuleInputSchema>;

/** Toplu kargo kuralı ekleme: UI'da stack'lenip tek istekte gönderilir. */
export const shippingRuleBatchInputSchema = z.object({
  rules: z
    .array(shippingRuleInputSchema)
    .min(1, "En az bir kural ekleyin")
    .max(200, "Tek seferde en fazla 200 kural"),
});
export type ShippingRuleBatchInput = z.infer<typeof shippingRuleBatchInputSchema>;

export interface ShippingRuleSummary {
  id: string;
  channelId: string;
  name: string;
  country: string | null;
  minQty: number | null;
  maxQty: number | null;
  minWeightGrams: number | null;
  maxWeightGrams: number | null;
  baseCost: string;
  perItemCost: string | null;
  currency: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  updatedAt: string;
}

// ---- Ödeme ücreti ----

export const paymentFeeRuleInputSchema = z.object({
  gateway: z.string().trim().min(1).max(128).optional(),
  percentage: rateInput.default("0"),
  fixedFee: moneyInput.default("0"),
  currency: currency.optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
});
export type PaymentFeeRuleInput = z.infer<typeof paymentFeeRuleInputSchema>;

export interface PaymentFeeRuleSummary {
  id: string;
  channelId: string;
  gateway: string | null;
  percentage: string;
  fixedFee: string;
  currency: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  updatedAt: string;
}

// ---- Vergi config ----

export const taxConfigInputSchema = z.object({
  salesTaxBorne: z.boolean().default(false),
  incomeTaxRate: rateInput.nullish(),
});
export type TaxConfigInput = z.infer<typeof taxConfigInputSchema>;

export interface TaxConfigSummary {
  channelId: string;
  salesTaxBorne: boolean;
  incomeTaxRate: string | null;
  updatedAt: string;
}

// ---- Özel giderler ----

export const EXPENSE_TYPES = ["one_time", "recurring"] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export const EXPENSE_RECURRENCES = ["daily", "weekly", "monthly"] as const;
export type ExpenseRecurrence = (typeof EXPENSE_RECURRENCES)[number];

export const EXPENSE_ALLOCATIONS = ["store", "spread"] as const;
export type ExpenseAllocation = (typeof EXPENSE_ALLOCATIONS)[number];

export const customExpenseInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    category: z.string().trim().min(1).max(64).optional(),
    type: z.enum(EXPENSE_TYPES),
    recurrence: z.enum(EXPENSE_RECURRENCES).optional(),
    allocation: z.enum(EXPENSE_ALLOCATIONS).default("store"),
    channelId: z.string().uuid().optional(),
    amount: moneyInput,
    currency: currency.default("USD"),
    startDate: isoDate,
    endDate: isoDate.optional(),
    active: z.boolean().default(true),
  })
  .refine((v) => v.type !== "recurring" || !!v.recurrence, {
    message: "recurring gider için recurrence zorunlu",
    path: ["recurrence"],
  })
  .refine((v) => v.allocation !== "store" || !!v.channelId, {
    message: "allocation=store için channelId zorunlu",
    path: ["channelId"],
  })
  .refine((v) => v.endDate == null || v.endDate >= v.startDate, {
    message: "endDate, startDate'den önce olamaz",
    path: ["endDate"],
  });
export type CustomExpenseInput = z.infer<typeof customExpenseInputSchema>;

export const customExpenseUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(64).nullish(),
  amount: moneyInput.optional(),
  currency: currency.optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.nullish(),
  active: z.boolean().optional(),
});
export type CustomExpenseUpdate = z.infer<typeof customExpenseUpdateSchema>;

export interface CustomExpenseSummary {
  id: string;
  storeId: string;
  channelId: string | null;
  name: string;
  category: string | null;
  type: ExpenseType;
  recurrence: ExpenseRecurrence | null;
  allocation: ExpenseAllocation;
  amount: string;
  currency: string;
  startDate: string;
  endDate: string | null;
  active: boolean;
  updatedAt: string;
}

/** Gün+mağaza seviyesine materialize edilmiş gider satırı (allocations görünümü). */
export interface ExpenseAllocationRow {
  channelId: string;
  date: string;
  amount: string;
  currency: string;
}

/** Bir gideri belirli aralıkta yeniden materialize etmek için. */
export const expenseMaterializeSchema = z
  .object({
    from: isoDate,
    to: isoDate,
  })
  .refine((v) => v.to >= v.from, {
    message: "to, from'dan önce olamaz",
    path: ["to"],
  });
export type ExpenseMaterializeInput = z.infer<typeof expenseMaterializeSchema>;

// ---- Maliyet çözümleme (debug/iç doğrulama) ----

export const costResolveQuerySchema = z.object({
  sku: z.string().trim().min(1).max(255).optional(),
  variantExternalId: z.string().trim().min(1).max(255).optional(),
  productExternalId: z.string().trim().min(1).max(255).optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  country: country.optional(),
  weightGrams: z.coerce.number().int().min(0).optional(),
  gateway: z.string().trim().min(1).max(128).optional(),
  amount: moneyInput.optional(),
  at: z.string().datetime().optional(),
});
export type CostResolveQuery = z.infer<typeof costResolveQuerySchema>;

export interface CostResolution {
  cogs: {
    unitCost: string;
    handlingFee: string;
    lineCogs: string;
    scope: CogsScope;
    ruleId: string;
  } | null;
  shipping: { cost: string; ruleId: string } | null;
  paymentFee: { fee: string; ruleId: string | null } | null;
  tax: { salesTaxBorne: boolean; incomeTaxRate: string | null };
}
