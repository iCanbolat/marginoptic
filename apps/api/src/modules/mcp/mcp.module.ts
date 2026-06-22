import { Module } from "@nestjs/common";
import { AnalyticsModule } from "../analytics/analytics.module";
import { ApiKeysModule } from "../api-keys/api-keys.module";
import { McpController } from "./mcp.controller";
import { McpDataProviderService } from "./mcp-data.provider";

/**
 * Faz 8 — MCP server (`packages/mcp`) NestJS entegrasyonu.
 * API key doğrulaması (`ApiKeysModule`) + analytics servisleri (`AnalyticsModule`)
 * üzerinden somut veri sağlayıcı; Streamable HTTP transport `McpController`'da mount edilir.
 */
@Module({
  imports: [AnalyticsModule, ApiKeysModule],
  controllers: [McpController],
  providers: [McpDataProviderService],
})
export class McpModule {}
