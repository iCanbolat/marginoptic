import type { MetricsTotals } from "@churnify/shared";
import {
  dailyNetProfit,
  emptyDaily,
  profitMargin,
  round4,
  type DailyMetricsAccumulator,
} from "../profit/contribution";

export const num = (v: string | number | null | undefined): number =>
  typeof v === "number" ? v : Number(v ?? 0);
export const f4 = (n: number): string => round4(n).toFixed(4);

/** Bir gün/mağaza satırının ham (string) metrik alanları. */
export interface RawMetricRow {
  revenue: string;
  discounts: string;
  refunds: string;
  cogs: string;
  shippingCost: string;
  paymentFees: string;
  taxes: string;
  adSpend: string;
  customExpenses: string;
  ordersCount: number;
  units: number;
}

/** Bir satırı toplayıcıya ekler. */
export function addRow(acc: DailyMetricsAccumulator, r: RawMetricRow): void {
  acc.revenue += num(r.revenue);
  acc.discounts += num(r.discounts);
  acc.refunds += num(r.refunds);
  acc.cogs += num(r.cogs);
  acc.shippingCost += num(r.shippingCost);
  acc.paymentFees += num(r.paymentFees);
  acc.taxes += num(r.taxes);
  acc.adSpend += num(r.adSpend);
  acc.customExpenses += num(r.customExpenses);
  acc.ordersCount += r.ordersCount;
  acc.units += r.units;
}

export function accumulate(rows: RawMetricRow[]): DailyMetricsAccumulator {
  const acc = emptyDaily();
  for (const r of rows) addRow(acc, r);
  return acc;
}

/** Toplayıcıdan KPI toplamları (net kâr + marj + blended ROAS/POAS). */
export function buildTotals(acc: DailyMetricsAccumulator): MetricsTotals {
  const netProfit = dailyNetProfit(acc);
  const ratio = (n: number): number | null =>
    acc.adSpend > 0 ? round4(n / acc.adSpend) : null;
  return {
    revenue: f4(acc.revenue),
    discounts: f4(acc.discounts),
    refunds: f4(acc.refunds),
    cogs: f4(acc.cogs),
    shippingCost: f4(acc.shippingCost),
    paymentFees: f4(acc.paymentFees),
    taxes: f4(acc.taxes),
    adSpend: f4(acc.adSpend),
    customExpenses: f4(acc.customExpenses),
    netProfit: f4(netProfit),
    ordersCount: acc.ordersCount,
    units: acc.units,
    margin: profitMargin(netProfit, acc.revenue),
    roas: ratio(acc.revenue),
    poas: ratio(netProfit),
  };
}

/** Yüzde değişim (önceki döneme göre); önceki 0/eksikse null. */
export function pctChange(curr: number, prev: number): number | null {
  if (!Number.isFinite(prev) || prev === 0) return null;
  return round4(((curr - prev) / Math.abs(prev)) * 100);
}

const DAY_MS = 86_400_000;

/** Aralığı bir önceki eşit-uzunluk döneme kaydırır (kapsayıcı gün sayısı). */
export function previousRange(
  from: string,
  to: string,
): { from: string; to: string } {
  const f = new Date(`${from}T00:00:00.000Z`);
  const t = new Date(`${to}T00:00:00.000Z`);
  const days = Math.round((t.getTime() - f.getTime()) / DAY_MS) + 1;
  const prevTo = new Date(f.getTime() - DAY_MS);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * DAY_MS);
  return {
    from: prevFrom.toISOString().slice(0, 10),
    to: prevTo.toISOString().slice(0, 10),
  };
}
