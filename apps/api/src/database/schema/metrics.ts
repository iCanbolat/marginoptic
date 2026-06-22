import {
  date,
  index,
  integer,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { stores } from "./stores";

/** Para alanları için ortak tip (sales/costs ile aynı): 20 basamak / 4 ondalık. */
const money = (name: string) => numeric(name, { precision: 20, scale: 4 });

/**
 * Faz 5 — Kâr motoru rollup tabloları (türetilmiş veri).
 * `metrics-rollup` kuyruğu sipariş katkı paylarını gün+mağaza seviyesine indirger;
 * pano/analitik bu tabloları okur (canlı hesap yapmaz). Hepsi idempotent yeniden
 * yazılır — rollup bir aralığı silip yeniden hesaplar.
 */

/** Gün + mağaza net kâr özeti (Bölüm 2.4 formülünün indirgenmiş hali). */
export const dailyStoreMetrics = pgTable(
  "daily_store_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    // Brüt ürün satışı (Σ satır price*qty); kargo geliri dahil değil.
    revenue: money("revenue").notNull().default("0"),
    discounts: money("discounts").notNull().default("0"),
    refunds: money("refunds").notNull().default("0"),
    cogs: money("cogs").notNull().default("0"),
    shippingCost: money("shipping_cost").notNull().default("0"),
    paymentFees: money("payment_fees").notNull().default("0"),
    // Satıcının üstlendiği satış vergisi (tax_config.sales_tax_borne).
    taxes: money("taxes").notNull().default("0"),
    // Reklam harcaması (Faz 6'da dolar; şimdilik 0).
    adSpend: money("ad_spend").notNull().default("0"),
    // Dağıtılmış özel giderler (expense_allocations).
    customExpenses: money("custom_expenses").notNull().default("0"),
    netProfit: money("net_profit").notNull().default("0"),
    ordersCount: integer("orders_count").notNull().default(0),
    units: integer("units").notNull().default(0),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_daily_metric_store_date").on(t.storeId, t.date),
    index("idx_daily_metric_store_date").on(t.storeId, t.date),
  ],
);

/** Gün + mağaza + ürün kârlılığı (ürün sıralaması/kırılımı için). */
export const productProfitDaily = pgTable(
  "product_profit_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    // Satır kaleminden gelen doğal anahtar (Shopify ürün id'si).
    productExternalId: varchar("product_external_id", { length: 255 }).notNull(),
    title: varchar("title", { length: 500 }),
    currency: varchar("currency", { length: 3 }).notNull(),
    units: integer("units").notNull().default(0),
    revenue: money("revenue").notNull().default("0"),
    cogs: money("cogs").notNull().default("0"),
    // Ürüne atfedilen reklam harcaması (Faz 6); şimdilik 0.
    attributedAdSpend: money("attributed_ad_spend").notNull().default("0"),
    // Ürün-seviyesi katkı: revenue − satır indirimi − cogs (blended maliyet hariç).
    netProfit: money("net_profit").notNull().default("0"),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_product_profit_store_product_date").on(
      t.storeId,
      t.productExternalId,
      t.date,
    ),
    index("idx_product_profit_store_date").on(t.storeId, t.date),
  ],
);

/** Döviz kuru tablosu (gün bazlı). `base→quote`; aynı para için kur = 1 (kayıt gerekmez). */
export const fxRates = pgTable(
  "fx_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date").notNull(),
    base: varchar("base", { length: 3 }).notNull(),
    quote: varchar("quote", { length: 3 }).notNull(),
    rate: numeric("rate", { precision: 20, scale: 10 }).notNull(),
    source: varchar("source", { length: 32 }).notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_fx_date_base_quote").on(t.date, t.base, t.quote),
    index("idx_fx_base_quote_date").on(t.base, t.quote, t.date),
  ],
);
