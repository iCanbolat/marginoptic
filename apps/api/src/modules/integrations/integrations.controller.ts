import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  type RawBodyRequest,
  Req,
  Res,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import {
  adConnectSchema,
  adInstallSchema,
  adProviderSchema,
  etsyConnectSchema,
  shopifyInstallSchema,
  type AdConnectInput,
  type AdInstallInput,
  type AdProvider,
  type EtsyConnectInput,
  type IntegrationsOverview,
  type ShopifyInstallInput,
  type ShopifyInstallResponse,
} from "@churnify/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  type ActiveOrg,
  CurrentOrg,
} from "../auth/decorators/current-org.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { IntegrationsService } from "./integrations.service";

@ApiTags("integrations")
@Controller("integrations")
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @ApiBearerAuth()
  @Get()
  overview(@CurrentOrg() org: ActiveOrg): Promise<IntegrationsOverview> {
    return this.integrations.overview(org.id);
  }

  @ApiBearerAuth()
  @Roles("owner", "admin")
  @Get("shopify/install")
  async install(
    @CurrentOrg() org: ActiveOrg,
    @Query(new ZodValidationPipe(shopifyInstallSchema)) query: ShopifyInstallInput,
  ): Promise<ShopifyInstallResponse> {
    return { url: await this.integrations.startShopifyInstall(org.id, query.shop) };
  }

  /** Shopify, kullanıcının tarayıcısını buraya yönlendirir (kimlik state ile). */
  @Public()
  @Get("shopify/callback")
  async callback(
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ): Promise<void> {
    const redirectUrl = await this.integrations.completeShopifyCallback(query);
    res.redirect(redirectUrl);
  }

  /** Dev-only: gerçek Shopify olmadan bağlantı simülasyonu. */
  @ApiBearerAuth()
  @Roles("owner", "admin")
  @Post("shopify/dev-connect")
  devConnect(
    @CurrentOrg() org: ActiveOrg,
    @Body(new ZodValidationPipe(shopifyInstallSchema)) dto: ShopifyInstallInput,
  ): Promise<{ storeId: string; connectionId: string }> {
    return this.integrations.devConnectShopify(org.id, dto.shop);
  }

  // ---- Etsy (Faz 9) ----

  @ApiBearerAuth()
  @Roles("owner", "admin")
  @Get("etsy/install")
  async etsyInstall(
    @CurrentOrg() org: ActiveOrg,
  ): Promise<ShopifyInstallResponse> {
    return { url: await this.integrations.startEtsyInstall(org.id) };
  }

  /** Etsy, kullanıcının tarayıcısını buraya yönlendirir (PKCE state ile). */
  @Public()
  @Get("etsy/callback")
  async etsyCallback(
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ): Promise<void> {
    res.redirect(await this.integrations.completeEtsyCallback(query));
  }

  /** Dev-only: gerçek Etsy olmadan bağlantı simülasyonu. */
  @ApiBearerAuth()
  @Roles("owner", "admin")
  @Post("etsy/dev-connect")
  etsyDevConnect(
    @CurrentOrg() org: ActiveOrg,
    @Body(new ZodValidationPipe(etsyConnectSchema)) dto: EtsyConnectInput,
  ): Promise<{ storeId: string; connectionId: string }> {
    return this.integrations.devConnectEtsy(org.id, dto.shop);
  }

  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @Post("webhooks/shopify")
  async shopifyWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-shopify-hmac-sha256") hmac: string,
    @Headers("x-shopify-topic") topic: string,
    @Headers("x-shopify-shop-domain") shop: string,
    @Headers("x-shopify-webhook-id") eventId: string,
  ): Promise<{ ok: true }> {
    await this.integrations.ingestShopifyWebhook({
      raw: req.rawBody,
      hmac,
      topic,
      shop,
      eventId,
    });
    return { ok: true };
  }

  // ---- Reklam hesapları (Faz 6) ----

  /** Reklam OAuth başlat: authorize URL döndür. */
  @ApiBearerAuth()
  @Roles("owner", "admin")
  @Get("ads/:provider/install")
  async adInstall(
    @CurrentOrg() org: ActiveOrg,
    @Param("provider", new ZodValidationPipe(adProviderSchema))
    provider: AdProvider,
    @Query(new ZodValidationPipe(adInstallSchema)) query: AdInstallInput,
  ): Promise<ShopifyInstallResponse> {
    return {
      url: await this.integrations.startAdInstall(
        org.id,
        provider,
        query.storeId,
      ),
    };
  }

  /** Reklam sağlayıcısı tarayıcıyı buraya yönlendirir. */
  @Public()
  @Get("ads/:provider/callback")
  async adCallback(
    @Param("provider", new ZodValidationPipe(adProviderSchema))
    provider: AdProvider,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ): Promise<void> {
    res.redirect(await this.integrations.completeAdCallback(provider, query));
  }

  /** Dev-only: gerçek reklam OAuth'u olmadan bağlantı simülasyonu. */
  @ApiBearerAuth()
  @Roles("owner", "admin")
  @Post("ads/:provider/dev-connect")
  adDevConnect(
    @CurrentOrg() org: ActiveOrg,
    @Param("provider", new ZodValidationPipe(adProviderSchema))
    provider: AdProvider,
    @Body(new ZodValidationPipe(adConnectSchema)) dto: AdConnectInput,
  ): Promise<{ connectionId: string; provider: AdProvider }> {
    return this.integrations.devConnectAd(
      org.id,
      provider,
      dto.storeId,
      dto.externalAccountId,
    );
  }

  @ApiBearerAuth()
  @Delete(":connectionId")
  @Roles("owner", "admin")
  @HttpCode(204)
  disconnect(
    @CurrentOrg() org: ActiveOrg,
    @Param("connectionId") connectionId: string,
  ): Promise<void> {
    return this.integrations.disconnect(org.id, connectionId);
  }
}
