import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { PlanId, SubscriptionStatus } from "@churnify/shared";
import { organizations } from "./auth";

/**
 * Faz 9 — Faturalandırma (creem.io).
 * Org başına tek abonelik (`subscriptions`); webhook'lar idempotent işlenir (`billing_events`).
 * Gerçek tahsilat Creem'de; burada plan + durum + dönem bilgisi aynalanır (entitlement/gating).
 */

export const billingPlan = pgEnum("billing_plan", ["basic", "pro"]);

/** Creem abonelik durumları (shared `SUBSCRIPTION_STATUSES` ile hizalı). */
export const subscriptionStatus = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "paused",
  "scheduled_cancel",
  "canceled",
  "expired",
]);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // org başına tek satır
    organizationId: uuid("organization_id")
      .notNull()
      .unique()
      .references(() => organizations.id, { onDelete: "cascade" }),
    plan: billingPlan("plan").notNull().$type<PlanId>(),
    status: subscriptionStatus("status").notNull().$type<SubscriptionStatus>(),
    // Creem tarafı kimlikler
    creemCustomerId: varchar("creem_customer_id", { length: 255 }),
    creemSubscriptionId: varchar("creem_subscription_id", { length: 255 }).unique(),
    creemProductId: varchar("creem_product_id", { length: 255 }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_subscription_org").on(t.organizationId)],
);

/**
 * Webhook idempotency + denetim. Creem `id` (event id) unique → tekrar teslimat no-op.
 */
export const billingEvents = pgTable(
  "billing_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creemEventId: varchar("creem_event_id", { length: 255 }).notNull().unique(),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_billing_event_org").on(t.organizationId)],
);
