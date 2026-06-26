import { z } from "zod";
import type {
  DailyStoreMetric,
  MetricsTotals,
  ProductProfitRow,
} from "./metrics.js";

/**
 * Faz 7 — Analytics API DTO sözleşmesi (API ⇄ web ortak).
 * Org-kapsamlı, çok-mağaza filtreli okuma uçları. Para alanları DB'de `numeric`
 * olduğundan yanıtta ondalık string döner. Çok para birimli org'larda toplamlar
 * raporlama para biriminde (ilk seçili mağaza) verilir — FX dönüşümü yapılmaz.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-MM-DD biçiminde olmalı");

/** "a,b,c" virgüllü query param → uuid dizisi; boş = org'un tüm mağazaları. */
const storeIdsParam = z.preprocess(
  (v) => {
    if (v == null || v === "") return [];
    if (Array.isArray(v)) return v;
    return String(v)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  },
  z.array(z.string().uuid()),
);

const boolParam = z.preprocess(
  (v) => v === true || v === "true" || v === "1",
  z.boolean(),
);

/** Ortak analitik filtresi: tarih aralığı + mağaza alt kümesi + karşılaştırma. */
export const analyticsFilterSchema = z
  .object({
    from: isoDate,
    to: isoDate,
    storeIds: storeIdsParam.optional().default([]),
    /** Bir önceki eşit-uzunlukta dönemle karşılaştır. */
    compare: boolParam.optional().default(false),
  })
  .refine((v) => v.to >= v.from, {
    message: "to, from'dan önce olamaz",
    path: ["to"],
  });
export type AnalyticsFilter = z.infer<typeof analyticsFilterSchema>;

/** Headline metrik yüzde değişimleri (önceki döneme göre). */
export interface PeriodDeltas {
  revenue: number | null;
  netProfit: number | null;
  ordersCount: number | null;
  adSpend: number | null;
  margin: number | null;
}

/** Önceki dönem karşılaştırması. */
export interface PeriodComparison {
  from: string;
  to: string;
  totals: MetricsTotals;
  deltas: PeriodDeltas;
}

/** Kâr özeti: seçili mağazaların aralık toplamları (+ opsiyonel karşılaştırma). */
export interface ProfitSummaryResponse {
  from: string;
  to: string;
  currency: string;
  storeIds: string[];
  totals: MetricsTotals;
  comparison: PeriodComparison | null;
}

/** P&L (gelir tablosu) satırı; cost satırlarında ciroya oran (%) verilir. */
export interface PnlLine {
  key: string;
  label: string;
  amount: string;
  /** Bu satırın ciroya oranı (yüzde); ciro 0 ise null. */
  pctOfRevenue: number | null;
  /** true = gider (eksi), false = gelir/sonuç. */
  isCost: boolean;
}

export interface PnlResponse {
  from: string;
  to: string;
  currency: string;
  storeIds: string[];
  lines: PnlLine[];
  netProfit: string;
  margin: number | null;
}

/** Zaman serisi: gün başına tüm metrikler, seçili mağazalar üzerinden toplanmış. */
export interface TimeseriesResponse {
  from: string;
  to: string;
  currency: string;
  storeIds: string[];
  points: DailyStoreMetric[];
}

/** Ürün kârlılık satırı (mağaza bilgisiyle, org genelinde sıralama için). */
export interface ProductRankingRow extends ProductProfitRow {
  channelId: string;
  storeName: string;
  /** Önceki dönem net kârı (yalnızca compare açıkken; aksi halde null). */
  previousNetProfit: string | null;
  /** Net kârın önceki döneme göre yüzde değişimi (compare kapalıysa null). */
  netProfitDelta: number | null;
}

export interface ProductRankingResponse {
  from: string;
  to: string;
  storeIds: string[];
  rows: ProductRankingRow[];
}

/** Çok-mağaza karşılaştırma satırı. */
export interface StoreComparisonRow {
  channelId: string;
  storeName: string;
  currency: string;
  totals: MetricsTotals;
}

export interface StoreComparisonResponse {
  from: string;
  to: string;
  rows: StoreComparisonRow[];
}

// ---- Müşteri analitiği (LTV / CAC / kohort) ----

export interface TopCustomer {
  channelId: string;
  customerExternalId: string;
  email: string | null;
  orders: number;
  revenue: string;
}

export interface CustomerLtvResponse {
  from: string;
  to: string;
  currency: string;
  customerCount: number;
  newCustomers: number;
  returningCustomers: number;
  /** Tekrar eden müşteri oranı (yüzde 0..100); müşteri yoksa null. */
  repeatRate: number | null;
  avgOrderValue: string;
  avgOrdersPerCustomer: number;
  /** Aralık-içi müşteri başına ortalama ciro (LTV vekili). */
  avgRevenuePerCustomer: string;
  topCustomers: TopCustomer[];
}

export interface CustomerCacResponse {
  from: string;
  to: string;
  currency: string;
  adSpend: string;
  newCustomers: number;
  /** Müşteri edinme maliyeti: reklam harcaması / yeni müşteri; yeni müşteri 0 ise null. */
  cac: string | null;
}

export interface CohortCell {
  /** Kohort ayından itibaren ay indeksi (0 = edinme ayı). */
  monthIndex: number;
  customers: number;
  revenue: string;
  /** Kohort büyüklüğüne oran (yüzde 0..100). */
  retentionPct: number | null;
}

export interface CohortRow {
  /** Edinme ayı (YYYY-MM). */
  cohort: string;
  size: number;
  cells: CohortCell[];
}

export interface CustomerCohortsResponse {
  from: string;
  to: string;
  cohorts: CohortRow[];
}

// ---- Özel metrik değerlendirme ----

/** Özel metrik formüllerinde kullanılabilen taban alanlar (whitelist). */
export const CUSTOM_METRIC_FIELDS = [
  "revenue",
  "discounts",
  "refunds",
  "cogs",
  "shippingCost",
  "paymentFees",
  "taxes",
  "adSpend",
  "customExpenses",
  "netProfit",
  "ordersCount",
  "units",
] as const;
export type CustomMetricField = (typeof CUSTOM_METRIC_FIELDS)[number];

export interface CustomMetricValue {
  id: string;
  name: string;
  format: CustomMetricFormat;
  formula: string;
  /** Değerlendirme sonucu; sıfıra bölme / geçersiz alan → null. */
  value: number | null;
}

export interface CustomMetricValuesResponse {
  from: string;
  to: string;
  storeIds: string[];
  currency: string;
  values: CustomMetricValue[];
}

export const CUSTOM_METRIC_FORMATS = ["currency", "number", "percent"] as const;
export type CustomMetricFormat = (typeof CUSTOM_METRIC_FORMATS)[number];
