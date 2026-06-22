import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { stores } from "./stores";

/** Para alanları için ortak tip: 20 basamak / 4 ondalık (Shopify string olarak döner). */
const money = (name: string) => numeric(name, { precision: 20, scale: 4 });

/**
 * Faz 3 — Shopify satış verisi (normalize).
 * Tüm tablolar `store_id` + sağlayıcı `external_id` ile tekil; idempotent upsert
 * `onConflictDoUpdate` ile (store_id, external_id) hedefine yazılır.
 */

/** Mağaza müşterisi. */
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }),
    firstName: varchar("first_name", { length: 200 }),
    lastName: varchar("last_name", { length: 200 }),
    ordersCount: integer("orders_count").notNull().default(0),
    totalSpent: money("total_spent"),
    currency: varchar("currency", { length: 3 }),
    shopifyCreatedAt: timestamp("shopify_created_at", { withTimezone: true }),
    shopifyUpdatedAt: timestamp("shopify_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_customer_store_external").on(t.storeId, t.externalId),
    index("idx_customer_store").on(t.storeId),
  ],
);

/** Ürün. */
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    handle: varchar("handle", { length: 500 }),
    status: varchar("status", { length: 32 }),
    vendor: varchar("vendor", { length: 255 }),
    productType: varchar("product_type", { length: 255 }),
    shopifyCreatedAt: timestamp("shopify_created_at", { withTimezone: true }),
    shopifyUpdatedAt: timestamp("shopify_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_product_store_external").on(t.storeId, t.externalId),
    index("idx_product_store").on(t.storeId),
  ],
);

/** Ürün varyantı (SKU bazlı maliyet eşleşmesinin temeli). */
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "cascade",
    }),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    externalProductId: varchar("external_product_id", { length: 255 }),
    sku: varchar("sku", { length: 255 }),
    title: varchar("title", { length: 500 }),
    price: money("price"),
    inventoryQuantity: integer("inventory_quantity"),
    shopifyCreatedAt: timestamp("shopify_created_at", { withTimezone: true }),
    shopifyUpdatedAt: timestamp("shopify_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_variant_store_external").on(t.storeId, t.externalId),
    index("idx_variant_store").on(t.storeId),
    index("idx_variant_sku").on(t.storeId, t.sku),
  ],
);

/** Sipariş başlığı (katkı payı hesabının çekirdek girdisi). */
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 64 }),
    email: varchar("email", { length: 320 }),
    customerExternalId: varchar("customer_external_id", { length: 255 }),
    financialStatus: varchar("financial_status", { length: 48 }),
    fulfillmentStatus: varchar("fulfillment_status", { length: 48 }),
    currency: varchar("currency", { length: 3 }),
    presentmentCurrency: varchar("presentment_currency", { length: 3 }),
    subtotalPrice: money("subtotal_price"),
    totalPrice: money("total_price"),
    totalDiscounts: money("total_discounts"),
    totalTax: money("total_tax"),
    totalShipping: money("total_shipping"),
    totalRefunded: money("total_refunded"),
    test: boolean("test").notNull().default(false),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    shopifyCreatedAt: timestamp("shopify_created_at", { withTimezone: true }),
    shopifyUpdatedAt: timestamp("shopify_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_order_store_external").on(t.storeId, t.externalId),
    index("idx_order_store_processed").on(t.storeId, t.processedAt),
  ],
);

/** Sipariş satırı (ürün/variant/qty/indirim). */
export const orderLineItems = pgTable(
  "order_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    productExternalId: varchar("product_external_id", { length: 255 }),
    variantExternalId: varchar("variant_external_id", { length: 255 }),
    sku: varchar("sku", { length: 255 }),
    title: varchar("title", { length: 500 }),
    quantity: integer("quantity").notNull().default(0),
    price: money("price"),
    discountAmount: money("discount_amount"),
    totalAmount: money("total_amount"),
  },
  (t) => [
    uniqueIndex("uq_line_item_store_external").on(t.storeId, t.externalId),
    index("idx_line_item_order").on(t.orderId),
    index("idx_line_item_variant").on(t.storeId, t.variantExternalId),
  ],
);

/** Sipariş ödeme hareketi (gateway ücreti dahil — net kâr için kritik). */
export const orderTransactions = pgTable(
  "order_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    kind: varchar("kind", { length: 32 }),
    status: varchar("status", { length: 32 }),
    gateway: varchar("gateway", { length: 128 }),
    amount: money("amount"),
    fee: money("fee"),
    currency: varchar("currency", { length: 3 }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("uq_txn_store_external").on(t.storeId, t.externalId),
    index("idx_txn_order").on(t.orderId),
  ],
);

/** İade. */
export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    amount: money("amount"),
    shippingRefunded: money("shipping_refunded"),
    taxRefunded: money("tax_refunded"),
    note: text("note"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    shopifyCreatedAt: timestamp("shopify_created_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("uq_refund_store_external").on(t.storeId, t.externalId),
    index("idx_refund_order").on(t.orderId),
  ],
);
