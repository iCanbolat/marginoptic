import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { WidgetConfig, WidgetType } from "@churnify/shared";
import { stores, users } from "./auth";

/**
 * Faz 7 — Pano özelleştirme.
 * Org-kapsamlı panolar + sürükle-bırak widget'lar (layout x/y/w/h) + özel metrikler
 * (whitelist alanlardan oluşan güvenli formül). Analytics modülü bu tabloları okur.
 */

export const widgetType = pgEnum("widget_type", [
  "kpi",
  "timeseries",
  "pnl",
  "products",
  "cost_breakdown",
  "channel",
  "custom_metric",
]);

export const customMetricFormat = pgEnum("custom_metric_format", [
  "currency",
  "number",
  "percent",
]);

/** Org panosu; org başına yalnız bir varsayılan (partial unique). */
export const dashboards = pgTable(
  "dashboards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 120 }).notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_dashboard_org").on(t.storeId),
    uniqueIndex("uq_dashboard_default")
      .on(t.storeId)
      .where(sql`${t.isDefault}`),
  ],
);

/** Pano widget'ı; `config` jsonb (metrik/görsel/override) + grid konumu. */
export const dashboardWidgets = pgTable(
  "dashboard_widgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dashboardId: uuid("dashboard_id")
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade" }),
    // İstemci üretimli kalıcı kimlik (react-grid-layout key eşlemesi).
    widgetKey: varchar("widget_key", { length: 64 }).notNull(),
    type: widgetType("type").notNull().$type<WidgetType>(),
    config: jsonb("config").notNull().default({}).$type<WidgetConfig>(),
    x: integer("x").notNull().default(0),
    y: integer("y").notNull().default(0),
    w: integer("w").notNull().default(4),
    h: integer("h").notNull().default(4),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_widget_dashboard").on(t.dashboardId),
    uniqueIndex("uq_widget_dashboard_key").on(t.dashboardId, t.widgetKey),
  ],
);

/** Özel metrik: whitelist alanlardan güvenli formül + format. Org başına ad tekil. */
export const customMetrics = pgTable(
  "custom_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    formula: text("formula").notNull(),
    format: customMetricFormat("format").notNull().default("number"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_custom_metric_org_name").on(t.storeId, t.name),
    index("idx_custom_metric_org").on(t.storeId),
  ],
);
