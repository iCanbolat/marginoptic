import { Controller, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";
import { pixelEventSchema, type StoreTrackingInfo } from "@churnify/shared";
import {
  type ActiveOrg,
  CurrentOrg,
} from "../auth/decorators/current-org.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { ProductTrafficService } from "./product-traffic.service";

/** Pixel `text/plain` (preflight'sız) gönderir → ham gövdeyi okuyup JSON çözeriz. */
function readRawBody(req: Request): Promise<string> {
  const body = (req as Request & { body?: unknown }).body;
  if (body && typeof body === "object") return Promise.resolve(JSON.stringify(body));
  if (typeof body === "string" && body.length > 0) return Promise.resolve(body);
  return new Promise((resolve) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (c: string) => {
      data += c;
      if (data.length > 65_536) data = data.slice(0, 65_536);
    });
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(""));
  });
}

@ApiTags("tracking")
@Controller()
export class TrackingController {
  constructor(private readonly traffic: ProductTrafficService) {}

  /**
   * Shopify Web Pixel olay alıcısı. Public + throttle dışı; pixel `browser.fetch`
   * ile `text/plain` (preflight'sız) JSON gönderir. Yanıt okunmaz → 204. Geçersiz
   * payload sessizce yok sayılır.
   */
  @Public()
  @SkipThrottle()
  @HttpCode(204)
  @Post("track/pixel")
  async pixel(@Req() req: Request): Promise<void> {
    const raw = await readRawBody(req);
    if (!raw) return;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return;
    }
    const parsed = pixelEventSchema.safeParse(json);
    if (!parsed.success) return;
    await this.traffic.recordPixelEvent(parsed.data);
  }

  /** Mağaza Web Pixel Account ID'si (pixel ayarına yapıştırılır). */
  @ApiBearerAuth()
  @Get("stores/:storeId/tracking")
  tracking(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
  ): Promise<StoreTrackingInfo> {
    return this.traffic.ensureTrackingInfo(org.id, storeId);
  }

  /** Amazon/eBay traffic'i şimdi yenile (manuel tetik; sync-all da kapsar). */
  @ApiBearerAuth()
  @Roles("owner", "admin")
  @HttpCode(200)
  @Post("stores/:storeId/tracking/marketplace-sync")
  async marketplaceSync(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
  ): Promise<{ synced: boolean }> {
    const synced = await this.traffic.syncMarketplaceTrafficForOrg(
      org.id,
      storeId,
    );
    return { synced };
  }
}
