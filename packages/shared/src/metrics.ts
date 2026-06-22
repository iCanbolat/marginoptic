import { z } from "zod";

/**
 * Faz 5 — Kâr motoru rollup DTO sözleşmesi (API ⇄ web ortak).
 * Para alanları DB'de `numeric` olduğundan yanıtta ondalık string döner.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-MM-DD biçiminde olmalı");

/** Gün+mağaza metrik sorgusu (tarih aralığı). */
export const metricsQuerySchema = z
  .object({
    from: isoDate,
    to: isoDate,
  })
  .refine((v) => v.to >= v.from, {
    message: "to, from'dan önce olamaz",
    path: ["to"],
  });
export type MetricsQuery = z.infer<typeof metricsQuerySchema>;

/** Bir günün mağaza metrikleri (daily_store_metrics satırı). */
export interface DailyStoreMetric {
  date: string;
  currency: string;
  revenue: string;
  discounts: string;
  refunds: string;
  cogs: string;
  shippingCost: string;
  paymentFees: string;
  taxes: string;
  adSpend: string;
  customExpenses: string;
  netProfit: string;
  ordersCount: number;
  units: number;
}

/** Aralık toplamları (KPI kartları için). */
export interface MetricsTotals {
  revenue: string;
  discounts: string;
  refunds: string;
  cogs: string;
  shippingCost: string;
  paymentFees: string;
  taxes: string;
  adSpend: string;
  customExpenses: string;
  netProfit: string;
  ordersCount: number;
  units: number;
  /** Net kâr / ciro (yüzde, 0..100); ciro 0 ise null. */
  margin: number | null;
  /** Blended ROAS: ciro / reklam harcaması; harcama 0 ise null. */
  roas: number | null;
  /** POAS: net kâr / reklam harcaması; harcama 0 ise null. */
  poas: number | null;
}

/** Mağaza metrik özeti: günlük seri + aralık toplamları. */
export interface StoreMetricsSummary {
  storeId: string;
  currency: string;
  from: string;
  to: string;
  days: DailyStoreMetric[];
  totals: MetricsTotals;
}

/** Ürün kârlılık satırı (product_profit_daily, ürün bazında toplanmış). */
export interface ProductProfitRow {
  productExternalId: string;
  title: string | null;
  currency: string;
  units: number;
  revenue: string;
  cogs: string;
  attributedAdSpend: string;
  netProfit: string;
}

/** Mağaza metriklerini yeniden hesaplama (manuel tetikleme) yanıtı. */
export interface RecomputeResult {
  storeId: string;
  enqueued: true;
}
