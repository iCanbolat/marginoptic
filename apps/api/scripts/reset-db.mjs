#!/usr/bin/env node
// @ts-check
/**
 * Dev DB sıfırlayıcı (destructive). `public` ŞEMASINI **ve** drizzle'ın migration
 * defterini tuttuğu `drizzle` şemasını birlikte düşürür. Yalnız `public` düşürmek
 * yetmez: `drizzle.__drizzle_migrations` kalırsa `db:migrate` uygulanmış sayar ve
 * tabloları yeniden oluşturmaz (no-op). Bu script ikisini de düşürür.
 *
 * Tek başına çalıştırmayın; `pnpm db:reset` migration'ı da uygular:
 *   db:reset = reset-db.mjs (drop) + drizzle-kit migrate (recreate)
 */
import { Pool } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL gerekli");
  const pool = new Pool({ connectionString });
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE;");
  await pool.query("CREATE SCHEMA public;");
  await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE;");
  await pool.end();
  // eslint-disable-next-line no-console
  console.log("✓ DB sıfırlandı (public + drizzle şemaları). Sırada: migrate.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("✗ DB sıfırlama başarısız:", err?.message ?? err);
  process.exit(1);
});
