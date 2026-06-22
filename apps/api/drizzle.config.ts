import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/database/schema/index.ts",
  out: "./src/database/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://churnify:churnify@localhost:5432/churnify",
  },
  casing: "snake_case",
  verbose: true,
  strict: true,
});
