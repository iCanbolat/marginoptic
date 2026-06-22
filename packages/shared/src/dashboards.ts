import { z } from "zod";
import { CUSTOM_METRIC_FIELDS, CUSTOM_METRIC_FORMATS } from "./analytics.js";

/**
 * Faz 7 — Pano özelleştirme DTO sözleşmesi (API ⇄ web ortak).
 * `dashboards` / `dashboard_widgets` / `custom_metrics` tabloları + widget config.
 */

/** Widget türleri (widget kütüphanesi). */
export const WIDGET_TYPES = [
  "kpi",
  "timeseries",
  "pnl",
  "products",
  "cost_breakdown",
  "channel",
  "custom_metric",
] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

/** KPI / time-series widget'larında seçilebilen metrikler (taban + türetilmiş). */
export const WIDGET_METRICS = [
  ...CUSTOM_METRIC_FIELDS,
  "margin",
  "roas",
  "poas",
] as const;
export type WidgetMetric = (typeof WIDGET_METRICS)[number];

export const WIDGET_VISUALS = ["line", "area", "bar", "donut"] as const;
export type WidgetVisual = (typeof WIDGET_VISUALS)[number];

/** Widget config (jsonb). Türü farklı alanları kullanır; hepsi opsiyonel. */
export const widgetConfigSchema = z.object({
  title: z.string().trim().max(120).optional(),
  /** kpi: tek metrik. */
  metric: z.string().max(64).optional(),
  /** timeseries: çok seri. */
  metrics: z.array(z.string().max(64)).max(6).optional(),
  visual: z.enum(WIDGET_VISUALS).optional(),
  /** products: sıralama uzunluğu. */
  limit: z.number().int().min(1).max(50).optional(),
  /** custom_metric widget'ı: hangi özel metrik. */
  customMetricId: z.string().uuid().optional(),
  /** Global tarih aralığını override eder. */
  dateOverride: z
    .object({ from: z.string(), to: z.string() })
    .nullable()
    .optional(),
  /** Önceki dönemle karşılaştır (kpi). */
  compare: z.boolean().optional(),
});
export type WidgetConfig = z.infer<typeof widgetConfigSchema>;

/** react-grid-layout konumu. */
export const widgetLayoutSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(24),
});
export type WidgetLayout = z.infer<typeof widgetLayoutSchema>;

export const widgetSchema = z.object({
  /** İstemci üretimli kalıcı kimlik (layout eşlemesi için). */
  id: z.string().min(1).max(64),
  type: z.enum(WIDGET_TYPES),
  config: widgetConfigSchema.default({}),
  layout: widgetLayoutSchema,
});
export type DashboardWidget = z.infer<typeof widgetSchema>;

/** Pano widget'larını toplu kaydet (layout persist). */
export const dashboardWidgetsSchema = z.object({
  widgets: z.array(widgetSchema).max(50),
});
export type DashboardWidgetsInput = z.infer<typeof dashboardWidgetsSchema>;

export const dashboardCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  isDefault: z.boolean().optional(),
});
export type DashboardCreateInput = z.infer<typeof dashboardCreateSchema>;

export const dashboardUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.isDefault !== undefined, {
    message: "En az bir alan gerekli",
  });
export type DashboardUpdateInput = z.infer<typeof dashboardUpdateSchema>;

export interface DashboardSummary {
  id: string;
  name: string;
  isDefault: boolean;
  widgetCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardDetail extends DashboardSummary {
  widgets: DashboardWidget[];
}

// ---- Özel metrikler (custom_metrics) ----

export const customMetricCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  /** Whitelist alanlar + sayı + ( ) + - * / operatörleri. */
  formula: z.string().trim().min(1).max(500),
  format: z.enum(CUSTOM_METRIC_FORMATS),
});
export type CustomMetricCreateInput = z.infer<typeof customMetricCreateSchema>;

export const customMetricUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    formula: z.string().trim().min(1).max(500).optional(),
    format: z.enum(CUSTOM_METRIC_FORMATS).optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.formula !== undefined ||
      v.format !== undefined,
    { message: "En az bir alan gerekli" },
  );
export type CustomMetricUpdateInput = z.infer<typeof customMetricUpdateSchema>;

export interface CustomMetricSummary {
  id: string;
  name: string;
  formula: string;
  format: (typeof CUSTOM_METRIC_FORMATS)[number];
  createdAt: string;
  updatedAt: string;
}
