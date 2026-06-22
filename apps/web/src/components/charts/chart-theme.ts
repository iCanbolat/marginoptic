import { formatCurrency, formatNumber, formatPercent } from "@churnify/shared";

/**
 * Tema uyumlu grafik renkleri. CSS değişkenlerine referans verir (index.css'teki
 * --chart-1..5); light/dark otomatik. Faz 7 widget'ları seri renklerini buradan alır.
 */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export function seriesColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]!;
}

export type ChartValueKind = "currency" | "number" | "percent";

export interface ValueFormatters {
  /** Eksen etiketi (kısa: 1,2 B). */
  axis: (value: number) => string;
  /** Tooltip / tam değer. */
  full: (value: number) => string;
}

/** Değer türüne göre eksen (kısa) ve tooltip (tam) biçimlendiricileri üretir. */
export function resolveFormatters(
  kind: ChartValueKind,
  currency = "USD",
): ValueFormatters {
  switch (kind) {
    case "currency":
      return {
        axis: (v) => formatCurrency(v, currency, { compact: true, fractionDigits: 1 }),
        full: (v) => formatCurrency(v, currency),
      };
    case "percent":
      return {
        axis: (v) => formatPercent(v, { fractionDigits: 0 }),
        full: (v) => formatPercent(v),
      };
    case "number":
    default:
      return {
        axis: (v) => formatNumber(v, { compact: true }),
        full: (v) => formatNumber(v),
      };
  }
}

/** Eksen/grid/legend için ortak tema sabitleri. */
export const AXIS_PROPS = {
  stroke: "var(--muted-foreground)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

export const GRID_STROKE = "var(--border)";
