/**
 * @churnify/shared — API ile web arasında paylaşılan tipler, zod şemaları ve util'ler.
 * Faz 1'den itibaren DTO şemaları (auth, stores, analytics) buraya eklenecek.
 */

export * from "./money.js";
export * from "./format.js";
export * from "./auth.js";
export * from "./integrations.js";
export * from "./sales.js";
export * from "./costs.js";
export * from "./metrics.js";
export * from "./ads.js";
export * from "./analytics.js";
export * from "./product-analytics.js";
export * from "./dashboards.js";
export * from "./mcp.js";
export * from "./billing.js";

/** Basit sağlık yanıtı sözleşmesi (Faz 0 doğrulaması için). */
export interface HealthResponse {
  status: "ok" | "error";
  uptime: number;
}
