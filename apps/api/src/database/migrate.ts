import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/**
 * Faz 9 — Üretim için programatik migration çalıştırıcı (drizzle-kit/devDeps gerektirmez).
 * `node dist/database/migrate.js` ile çalıştırılır (cwd = /app). SQL dosyaları image'a
 * dahildir (`src/database/migrations`). Üretim Docker akışında api'den önce çalışır.
 */
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL gerekli");
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);
  const migrationsFolder =
    process.env.MIGRATIONS_FOLDER ?? "src/database/migrations";
  await migrate(db, { migrationsFolder });
  await pool.end();
  // eslint-disable-next-line no-console
  console.log("Migrations uygulandı:", migrationsFolder);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Migration başarısız:", err);
  process.exit(1);
});
