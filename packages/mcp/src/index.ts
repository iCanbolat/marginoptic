/**
 * @churnify/mcp — Faz 8 MCP server.
 * Çerçeveden bağımsız tool kataloğu + veri sözleşmesi + Streamable HTTP server kurulumu.
 * `apps/api` somut `McpDataProvider` (analytics servisleri) sağlar ve transport'u mount eder.
 */
export * from "./provider.js";
export * from "./tools.js";
export * from "./server.js";
