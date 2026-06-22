import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  type RawBodyRequest,
} from "@nestjs/common";
import type { Request } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import {
  billingCheckoutSchema,
  billingDevActivateSchema,
  type BillingCheckoutInput,
  type BillingDevActivateInput,
  type BillingRedirectResponse,
  type BillingState,
} from "@churnify/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthContext } from "../auth/auth.types";
import {
  type ActiveOrg,
  CurrentOrg,
} from "../auth/decorators/current-org.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { BillingService } from "./billing.service";

/**
 * Faz 9 — Faturalandırma (creem.io). Durum okuma tüm üyelere; checkout/portal/
 * dev-activate owner/admin'e kısıtlı. Webhook `@Public` + HMAC doğrulamalı.
 */
@ApiTags("billing")
@Controller("billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @ApiBearerAuth()
  getState(@CurrentOrg() org: ActiveOrg): Promise<BillingState> {
    return this.billing.getState(org.id);
  }

  @Post("checkout")
  @ApiBearerAuth()
  @Roles("owner", "admin")
  async checkout(
    @CurrentOrg() org: ActiveOrg,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(billingCheckoutSchema)) dto: BillingCheckoutInput,
  ): Promise<BillingRedirectResponse> {
    return { url: await this.billing.createCheckout(org.id, user.email, dto.plan) };
  }

  @Post("portal")
  @ApiBearerAuth()
  @Roles("owner", "admin")
  async portal(@CurrentOrg() org: ActiveOrg): Promise<BillingRedirectResponse> {
    return { url: await this.billing.createPortal(org.id) };
  }

  /** Dev/sentetik plan etkinleştirme (non-prod, Creem anahtarı yokken). */
  @Post("dev-activate")
  @ApiBearerAuth()
  @Roles("owner", "admin")
  devActivate(
    @CurrentOrg() org: ActiveOrg,
    @Body(new ZodValidationPipe(billingDevActivateSchema))
    dto: BillingDevActivateInput,
  ): Promise<BillingState> {
    return this.billing.devActivate(org.id, dto.plan);
  }

  /** Creem webhook ucu — ham gövde + `creem-signature` (HMAC-SHA256). */
  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @Post("webhook")
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("creem-signature") signature: string,
  ): Promise<{ ok: true }> {
    await this.billing.handleWebhook(req.rawBody, signature);
    return { ok: true };
  }
}
