import type { IncomingMessage, ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpScope } from "@churnify/shared";
import type { McpDataProvider, McpToolContext } from "./provider.js";
import { MCP_TOOLS } from "./tools.js";

export const MCP_SERVER_INFO = { name: "churnify", version: "0.1.0" } as const;

export interface BuildServerOptions {
  provider: McpDataProvider;
  context: McpToolContext;
  /** Bu key'in kapsamları — yalnız izinli tool'lar kaydedilir. */
  scopes: McpScope[];
}

/**
 * Kapsamlara göre izinli tool'ları kayıtlı bir McpServer kurar.
 * Handler sonuçları REST DTO'larıyla aynı; metin içerikte JSON olarak döner.
 */
export function buildMcpServer(opts: BuildServerOptions): McpServer {
  const server = new McpServer(MCP_SERVER_INFO, {
    instructions:
      "Churnify çok-kanallı net kâr analitiği. Salt-okunur raporlama tool'ları; " +
      "tarihler YYYY-MM-DD, storeIds boş bırakılırsa org'un tüm mağazaları kullanılır.",
  });

  const allowed = new Set(opts.scopes);
  for (const tool of MCP_TOOLS) {
    if (!allowed.has(tool.scope)) continue;
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      async (args: Record<string, unknown>) => {
        const data = await tool.handler(opts.provider, opts.context, args ?? {});
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(data, null, 2) },
          ],
        };
      },
    );
  }
  return server;
}

/**
 * Tek bir MCP HTTP isteğini **stateless** modda yanıtlar (oturumsuz; yatay ölçeklenir).
 * Her istekte taze server + transport kurulur ve yanıt sonrası kapatılır.
 * `body` çağıran tarafından parse edilmiş JSON-RPC gövdesidir (POST için).
 */
export async function handleMcpRequest(
  opts: BuildServerOptions & {
    req: IncomingMessage;
    res: ServerResponse;
    body?: unknown;
  },
): Promise<void> {
  const server = buildMcpServer(opts);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  opts.res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(opts.req, opts.res, opts.body);
}
