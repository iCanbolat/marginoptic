import type { MetricsTotals, WidgetConfig, WidgetType } from "@churnify/shared";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

export type MetricKind = "currency" | "number" | "percent" | "ratio";

export interface MetricMeta {
  key: string;
  label: string;
  kind: MetricKind;
}

/** KPI/time-series/özel metrik seçiminde sunulan metrikler. */
export const METRIC_CATALOG: MetricMeta[] = [
  { key: "revenue", label: "Ciro", kind: "currency" },
  { key: "netProfit", label: "Net Kâr", kind: "currency" },
  { key: "cogs", label: "COGS", kind: "currency" },
  { key: "shippingCost", label: "Kargo", kind: "currency" },
  { key: "paymentFees", label: "Ödeme Ücretleri", kind: "currency" },
  { key: "taxes", label: "Vergiler", kind: "currency" },
  { key: "adSpend", label: "Reklam Harcaması", kind: "currency" },
  { key: "customExpenses", label: "Özel Giderler", kind: "currency" },
  { key: "discounts", label: "İndirimler", kind: "currency" },
  { key: "refunds", label: "İadeler", kind: "currency" },
  { key: "ordersCount", label: "Sipariş", kind: "number" },
  { key: "units", label: "Adet", kind: "number" },
  { key: "margin", label: "Net Marj", kind: "percent" },
  { key: "roas", label: "ROAS", kind: "ratio" },
  { key: "poas", label: "POAS", kind: "ratio" },
];

export function metricMeta(key: string): MetricMeta {
  return (
    METRIC_CATALOG.find((m) => m.key === key) ?? {
      key,
      label: key,
      kind: "number",
    }
  );
}

/** `MetricsTotals`'tan sayısal değer (string para alanları parse edilir). */
export function totalValue(
  totals: MetricsTotals,
  key: string,
): number | null {
  const v = (totals as unknown as Record<string, unknown>)[key];
  if (v == null) return null;
  return typeof v === "number" ? v : Number(v);
}

/** Bir metrik değerini türüne göre biçimler. */
export function formatMetric(
  value: number | null | undefined,
  kind: MetricKind,
  currency: string,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  switch (kind) {
    case "currency":
      return formatCurrency(value, currency);
    case "percent":
      return formatPercent(value, { fractionDigits: 1 });
    case "ratio":
      return `${value.toFixed(2)}×`;
    default:
      return formatNumber(value, { fractionDigits: 2 });
  }
}

export const WIDGET_LABEL: Record<WidgetType, string> = {
  kpi: "KPI Kartı",
  timeseries: "Zaman Serisi",
  pnl: "P&L Tablosu",
  products: "Ürün Kârlılığı",
  cost_breakdown: "Maliyet Kırılımı",
  channel: "Kanal Karşılaştırma",
  custom_metric: "Özel Metrik",
};

export const WIDGET_DESCRIPTION: Record<WidgetType, string> = {
  kpi: "Tek metrik + dönem karşılaştırma",
  timeseries: "Çok serili gün bazlı trend",
  pnl: "Gelir tablosu (gelir → net kâr)",
  products: "Net kâra göre ürün sıralaması",
  cost_breakdown: "Gider dağılımı (donut)",
  channel: "Reklam kanalı performansı",
  custom_metric: "Kendi formül metriğin",
};

export interface WidgetDefault {
  config: WidgetConfig;
  w: number;
  h: number;
}

/** Yeni widget eklerken varsayılan config + grid boyutu. */
export const WIDGET_DEFAULTS: Record<WidgetType, WidgetDefault> = {
  kpi: { config: { metric: "netProfit", compare: true }, w: 3, h: 2 },
  timeseries: {
    config: { metrics: ["revenue", "netProfit"], visual: "area" },
    w: 6,
    h: 4,
  },
  pnl: { config: {}, w: 4, h: 5 },
  products: { config: { limit: 8 }, w: 5, h: 5 },
  cost_breakdown: { config: { visual: "donut" }, w: 4, h: 4 },
  channel: { config: {}, w: 5, h: 4 },
  custom_metric: { config: {}, w: 3, h: 2 },
};
