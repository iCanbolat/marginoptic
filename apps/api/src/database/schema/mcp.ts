import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { McpScope } from "@churnify/shared";
import { stores, users } from "./auth";

/**
 * Faz 8 — MCP per-org API key'leri.
 * Ham anahtar asla saklanmaz: `key_hash` = sha256(rawKey) (unique), `key_prefix` tanıma için.
 * `scopes` tool erişimini kapsam bazında sınırlar; `revoked_at` ile iptal, soft-delete.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    // sha256(rawKey) hex — ham anahtar asla saklanmaz
    keyHash: varchar("key_hash", { length: 64 }).notNull().unique(),
    // ham anahtarın ilk karakterleri (örn. "chk_a1b2c3") — tanıma için
    keyPrefix: varchar("key_prefix", { length: 16 }).notNull(),
    scopes: text("scopes").array().notNull().$type<McpScope[]>(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_api_key_org").on(t.storeId)],
);
