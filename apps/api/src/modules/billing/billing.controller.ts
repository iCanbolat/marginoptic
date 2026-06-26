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
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { BillingService } from "./billing.service";

/**
 * Faz 9 — Faturalandırma (creem.io). Hesap (kullanıcı) başına abonelik; tüm
 * mağazaları kapsar. Webhook `@Public` + HMAC doğrulamalı.
 */
@ApiTags("billing")
@Controller("billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @ApiBearerAuth()
  getState(@CurrentUser() user: AuthContext): Promise<BillingState> {
    return this.billing.getState(user.userId);
  }

  @Post("checkout")
  @ApiBearerAuth()
  async checkout(
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(billingCheckoutSchema)) dto: BillingCheckoutInput,
  ): Promise<BillingRedirectResponse> {
    return { url: await this.billing.createCheckout(user.userId, user.email, dto.plan) };
  }

  @Post("portal")
  @ApiBearerAuth()
  async portal(@CurrentUser() user: AuthContext): Promise<BillingRedirectResponse> {
    return { url: await this.billing.createPortal(user.userId) };
  }

  /** Dev/sentetik plan etkinleştirme (non-prod, Creem anahtarı yokken). */
  @Post("dev-activate")
  @ApiBearerAuth()
  devActivate(
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(billingDevActivateSchema))
    dto: BillingDevActivateInput,
  ): Promise<BillingState> {
    return this.billing.devActivate(user.userId, dto.plan);
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
