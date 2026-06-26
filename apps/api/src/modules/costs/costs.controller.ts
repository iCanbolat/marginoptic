import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  cogsCsvImportSchema,
  cogsRuleBatchInputSchema,
  cogsRuleInputSchema,
  cogsRuleUpdateSchema,
  costResolveQuerySchema,
  paymentFeeRuleInputSchema,
  shippingRuleBatchInputSchema,
  shippingRuleInputSchema,
  taxConfigInputSchema,
  type CogsCsvImportInput,
  type CogsCsvImportResult,
  type CogsRuleBatchInput,
  type CogsRuleInput,
  type CogsRuleSummary,
  type CogsRuleUpdate,
  type CostResolution,
  type CostResolveQuery,
  type PaymentFeeRuleInput,
  type PaymentFeeRuleSummary,
  type ShippingRuleBatchInput,
  type ShippingRuleInput,
  type ShippingRuleSummary,
  type TaxConfigInput,
  type TaxConfigSummary,
} from "@churnify/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  type ActiveStore,
  CurrentStore,
} from "../auth/decorators/current-store.decorator";
import { CogsService } from "./cogs.service";
import { CostResolverService } from "./cost-resolver.service";
import { CostRulesService } from "./cost-rules.service";

/** Maliyet düzenleme yetkisi: viewer hariç (owner/admin/analyst). */
const EDIT_ROLES = ["owner", "admin", "analyst"] as const;

@ApiTags("costs")
@ApiBearerAuth()
@Controller("channels/:channelId/costs")
export class CostsController {
  constructor(
    private readonly cogs: CogsService,
    private readonly rules: CostRulesService,
    private readonly resolver: CostResolverService,
  ) {}

  // ---- COGS ----

  @Get("cogs")
  listCogs(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
  ): Promise<CogsRuleSummary[]> {
    return this.cogs.list(org.id, channelId);
  }

  @Post("cogs")
  createCogs(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Body(new ZodValidationPipe(cogsRuleInputSchema)) dto: CogsRuleInput,
  ): Promise<CogsRuleSummary> {
    return this.cogs.create(org.id, channelId, dto);
  }

  @Post("cogs/batch")
  createCogsBatch(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Body(new ZodValidationPipe(cogsRuleBatchInputSchema))
    dto: CogsRuleBatchInput,
  ): Promise<CogsRuleSummary[]> {
    return this.cogs.createMany(org.id, channelId, dto.rules);
  }

  @Patch("cogs/:id")
  updateCogs(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(cogsRuleUpdateSchema)) dto: CogsRuleUpdate,
  ): Promise<CogsRuleSummary> {
    return this.cogs.update(org.id, channelId, id, dto);
  }

  @Delete("cogs/:id")
  @HttpCode(204)
  removeCogs(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.cogs.remove(org.id, channelId, id);
  }

  @Post("cogs/import")
  importCogs(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Body(new ZodValidationPipe(cogsCsvImportSchema)) dto: CogsCsvImportInput,
  ): Promise<CogsCsvImportResult> {
    return this.cogs.importCsv(org.id, channelId, dto);
  }

  // ---- Kargo ----

  @Get("shipping")
  listShipping(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
  ): Promise<ShippingRuleSummary[]> {
    return this.rules.listShipping(org.id, channelId);
  }

  @Post("shipping")
  createShipping(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Body(new ZodValidationPipe(shippingRuleInputSchema)) dto: ShippingRuleInput,
  ): Promise<ShippingRuleSummary> {
    return this.rules.createShipping(org.id, channelId, dto);
  }

  @Post("shipping/batch")
  createShippingBatch(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Body(new ZodValidationPipe(shippingRuleBatchInputSchema))
    dto: ShippingRuleBatchInput,
  ): Promise<ShippingRuleSummary[]> {
    return this.rules.createManyShipping(org.id, channelId, dto.rules);
  }

  @Patch("shipping/:id")
  updateShipping(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(shippingRuleInputSchema)) dto: ShippingRuleInput,
  ): Promise<ShippingRuleSummary> {
    return this.rules.updateShipping(org.id, channelId, id, dto);
  }

  @Delete("shipping/:id")
  @HttpCode(204)
  removeShipping(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.rules.removeShipping(org.id, channelId, id);
  }

  // ---- Ödeme ücretleri ----

  @Get("payment-fees")
  listPaymentFees(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
  ): Promise<PaymentFeeRuleSummary[]> {
    return this.rules.listPaymentFees(org.id, channelId);
  }

  @Post("payment-fees")
  createPaymentFee(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Body(new ZodValidationPipe(paymentFeeRuleInputSchema))
    dto: PaymentFeeRuleInput,
  ): Promise<PaymentFeeRuleSummary> {
    return this.rules.createPaymentFee(org.id, channelId, dto);
  }

  @Patch("payment-fees/:id")
  updatePaymentFee(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(paymentFeeRuleInputSchema))
    dto: PaymentFeeRuleInput,
  ): Promise<PaymentFeeRuleSummary> {
    return this.rules.updatePaymentFee(org.id, channelId, id, dto);
  }

  @Delete("payment-fees/:id")
  @HttpCode(204)
  removePaymentFee(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.rules.removePaymentFee(org.id, channelId, id);
  }

  // ---- Vergi config ----

  @Get("tax")
  getTax(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
  ): Promise<TaxConfigSummary> {
    return this.rules.getTaxConfig(org.id, channelId);
  }

  @Put("tax")
  upsertTax(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Body(new ZodValidationPipe(taxConfigInputSchema)) dto: TaxConfigInput,
  ): Promise<TaxConfigSummary> {
    return this.rules.upsertTaxConfig(org.id, channelId, dto);
  }

  // ---- Maliyet çözümleme (debug / iç doğrulama) ----

  @Get("resolve")
  async resolve(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Query(new ZodValidationPipe(costResolveQuerySchema)) query: CostResolveQuery,
  ): Promise<CostResolution> {
    await this.resolver.assertStore(org.id, channelId); // org-sahiplik (404 atar)
    return this.resolver.resolveAll({
      channelId,
      sku: query.sku,
      variantExternalId: query.variantExternalId,
      productExternalId: query.productExternalId,
      quantity: query.quantity,
      country: query.country,
      weightGrams: query.weightGrams,
      gateway: query.gateway,
      amount: query.amount,
      at: query.at ? new Date(query.at) : undefined,
    });
  }
}
