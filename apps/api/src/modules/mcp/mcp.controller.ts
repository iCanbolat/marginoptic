import { Controller, Delete, Get, Post, Req, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { handleMcpRequest } from "@churnify/mcp";
import { planAllows } from "@churnify/shared";
import { Public } from "../auth/decorators/public.decorator";
import { ApiKeysService } from "../api-keys/api-keys.service";
import { BillingService } from "../billing/billing.service";
import { McpDataProviderService } from "./mcp-data.provider";

/** Authorization: Bearer <key> veya x-api-key header'ından ham anahtarı çıkarır. */
function extractApiKey(req: Request): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    return auth.slice(7).trim() || null;
  }
  const header = req.headers["x-api-key"];
  const x = Array.isArray(header) ? header[0] : header;
  return typeof x === "string" && x.trim() ? x.trim() : null;
}

/**
 * Faz 8 — MCP Streamable HTTP ucu (`POST/GET/DELETE /api/mcp`).
 * Per-org API key ile yetkilendirir (JWT değil → @Public), anahtarın kapsamlarına göre
 * izinli tool'ları sunan stateless bir MCP server'a isteği devreder.
 */
@ApiExcludeController()
@Public()
@Controller("mcp")
export class McpController {
  constructor(
    private readonly apiKeys: ApiKeysService,
    private readonly provider: McpDataProviderService,
    private readonly billing: BillingService,
  ) {}

  @Post()
  post(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.handle(req, res, req.body);
  }

  @Get()
  get(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.handle(req, res);
  }

  @Delete()
  remove(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.handle(req, res);
  }

  private async handle(
    req: Request,
    res: Response,
    body?: unknown,
  ): Promise<void> {
    const verified = await this.apiKeys.verify(extractApiKey(req));
    if (!verified) {
      res
        .status(401)
        .set("WWW-Authenticate", 'Bearer realm="churnify-mcp"')
        .json({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32001, message: "Geçersiz veya eksik API anahtarı" },
        });
      return;
    }

    // MCP yalnız Pro plana özel: anahtar sahibinin (mağaza) planını doğrula.
    const ent = await this.billing.entitlementForStore(verified.storeId);
    if (!ent || !planAllows(ent.plan, "mcp")) {
      res.status(403).json({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32003, message: "MCP (AI analizi) Pro plana özeldir" },
      });
      return;
    }

    await handleMcpRequest({
      provider: this.provider,
      context: { storeId: verified.storeId },
      scopes: verified.scopes,
      req,
      res,
      body,
    });
  }
}
