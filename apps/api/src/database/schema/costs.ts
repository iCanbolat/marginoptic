import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { stores } from "./auth";
import { channels } from "./channels";

/** Para alanları için ortak tip (sales.ts ile aynı): 20 basamak / 4 ondalık. */
const money = (name: string) => numeric(name, { precision: 20, scale: 4 });
/** Yüzde (ör. 2.9 = %2.9). */
const rate = (name: string) => numeric(name, { precision: 7, scale: 4 });

/**
 * Faz 4 — Maliyet modelleme.
 * Mağaza-kapsamlı kurallar (COGS/kargo/ücret/vergi) + org-kapsamlı özel giderler.
 * Net kâr motoru (Faz 5) bu kuralları `cost-resolver` ile sipariş satırına uygular.
 */

/** COGS kuralının eşleşme kapsamı; çözümleme önceliği: sku > variant > product > global. */
export const cogsScope = pgEnum("cogs_scope", [
  "sku",
  "variant",
  "product",
  "global",
]);

export const expenseType = pgEnum("expense_type", ["one_time", "recurring"]);
export const expenseRecurrence = pgEnum("expense_recurrence", [
  "daily",
  "weekly",
  "monthly",
]);
/** store: tek mağazaya yazılır · spread: org'un aktif mağazalarına eşit dağıtılır. */
export const expenseAllocation = pgEnum("expense_allocation", [
  "store",
  "spread",
]);

/**
 * Ürün maliyeti (COGS) kuralı. `matchValue` kapsam'a göre yorumlanır:
 * sku → line.sku · variant → variantExternalId · product → productExternalId · global → null.
 */
export const cogsRules = pgTable(
  "cogs_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    scope: cogsScope("scope").notNull(),
    matchValue: varchar("match_value", { length: 255 }),
    // ISO-3166-1 alpha-2 (varış ülkesi); null = tüm ülkeler.
    country: varchar("country", { length: 2 }),
    // Bu kuralın geçerli olduğu en düşük adet (kademeli fiyat); varsayılan 1.
    minQty: integer("min_qty").notNull().default(1),
    costAmount: money("cost_amount").notNull(),
    handlingFee: money("handling_fee"),
    currency: varchar("currency", { length: 3 }),
    // null = açık uçlu (her zaman geçerli).
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    source: varchar("source", { length: 32 }).notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_cogs_lookup").on(t.channelId, t.scope, t.matchValue),
    // CSV/manuel tekrar import'ta idempotent upsert için "açık uçlu varsayılan kural"
    // anahtarı: (store, scope, matchValue) tek olmalı.
    uniqueIndex("uq_cogs_default_rule")
      .on(t.channelId, t.scope, t.matchValue)
      .where(
        sql`${t.effectiveFrom} is null and ${t.country} is null and ${t.minQty} = 1`,
      ),
  ],
);

/** Kargo maliyeti kuralı (ağırlık/adet/varış aralıklarına göre). */
export const shippingCostRules = pgTable(
  "shipping_cost_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    country: varchar("country", { length: 2 }),
    minQty: integer("min_qty"),
    maxQty: integer("max_qty"),
    minWeightGrams: integer("min_weight_grams"),
    maxWeightGrams: integer("max_weight_grams"),
    // Sipariş başına sabit + adet başına değişken.
    baseCost: money("base_cost").notNull().default("0"),
    perItemCost: money("per_item_cost"),
    currency: varchar("currency", { length: 3 }),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    source: varchar("source", { length: 32 }).notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_shipping_store").on(t.channelId)],
);

/** Ödeme/işlem ücreti kuralı (gateway bazlı yüzde + sabit). */
export const paymentFeeRules = pgTable(
  "payment_fee_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    // null = tüm gateway'ler (varsayılan ücret).
    gateway: varchar("gateway", { length: 128 }),
    percentage: rate("percentage").notNull().default("0"),
    fixedFee: money("fixed_fee").notNull().default("0"),
    currency: varchar("currency", { length: 3 }),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    source: varchar("source", { length: 32 }).notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_payment_fee_store").on(t.channelId, t.gateway)],
);

/** Mağaza başına vergi davranışı (tek kayıt). */
export const taxConfig = pgTable(
  "tax_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    // pass_through: tahsil edilen vergi maliyet değil · borne: satıcı üstlenir (maliyet).
    salesTaxBorne: boolean("sales_tax_borne").notNull().default(false),
    // Net kâr üzerinden gelir vergisi oranı (opsiyonel; null = uygulanmaz).
    incomeTaxRate: rate("income_tax_rate"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("uq_tax_config_store").on(t.channelId)],
);

/** Özel gider (tek seferlik veya yinelenen); org-kapsamlı, mağazaya atfedilebilir. */
export const customExpenses = pgTable(
  "custom_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    // allocation = store iken zorunlu; spread iken null (org'a yayılır).
    channelId: uuid("channel_id").references(() => channels.id, {
      onDelete: "cascade",
    }),
    name: varchar("name", { length: 200 }).notNull(),
    category: varchar("category", { length: 64 }),
    type: expenseType("type").notNull(),
    // type=recurring iken dolu; one_time iken null.
    recurrence: expenseRecurrence("recurrence"),
    allocation: expenseAllocation("allocation").notNull().default("store"),
    amount: money("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_custom_expense_org").on(t.storeId),
    index("idx_custom_expense_store").on(t.channelId),
  ],
);

/**
 * Özel giderlerin gün+mağaza seviyesine materialize edilmiş hali (rollup'ın okuduğu).
 * recurring-expenses kuyruğu yazar; (expense, store, date) idempotent.
 */
export const expenseAllocations = pgTable(
  "expense_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customExpenseId: uuid("custom_expense_id")
      .notNull()
      .references(() => customExpenses.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    amount: money("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_expense_alloc").on(t.customExpenseId, t.channelId, t.date),
    index("idx_expense_alloc_store_date").on(t.channelId, t.date),
  ],
);
