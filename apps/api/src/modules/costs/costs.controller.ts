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
  cogsRuleInputSchema,
  cogsRuleUpdateSchema,
  costResolveQuerySchema,
  paymentFeeRuleInputSchema,
  shippingRuleInputSchema,
  taxConfigInputSchema,
  type CogsCsvImportInput,
  type CogsCsvImportResult,
  type CogsRuleInput,
  type CogsRuleSummary,
  type CogsRuleUpdate,
  type CostResolution,
  type CostResolveQuery,
  type PaymentFeeRuleInput,
  type PaymentFeeRuleSummary,
  type ShippingRuleInput,
  type ShippingRuleSummary,
  type TaxConfigInput,
  type TaxConfigSummary,
} from "@churnify/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  type ActiveOrg,
  CurrentOrg,
} from "../auth/decorators/current-org.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { CogsService } from "./cogs.service";
import { CostResolverService } from "./cost-resolver.service";
import { CostRulesService } from "./cost-rules.service";

/** Maliyet düzenleme yetkisi: viewer hariç (owner/admin/analyst). */
const EDIT_ROLES = ["owner", "admin", "analyst"] as const;

@ApiTags("costs")
@ApiBearerAuth()
@Controller("stores/:storeId/costs")
export class CostsController {
  constructor(
    private readonly cogs: CogsService,
    private readonly rules: CostRulesService,
    private readonly resolver: CostResolverService,
  ) {}

  // ---- COGS ----

  @Get("cogs")
  listCogs(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
  ): Promise<CogsRuleSummary[]> {
    return this.cogs.list(org.id, storeId);
  }

  @Post("cogs")
  @Roles(...EDIT_ROLES)
  createCogs(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
    @Body(new ZodValidationPipe(cogsRuleInputSchema)) dto: CogsRuleInput,
  ): Promise<CogsRuleSummary> {
    return this.cogs.create(org.id, storeId, dto);
  }

  @Patch("cogs/:id")
  @Roles(...EDIT_ROLES)
  updateCogs(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(cogsRuleUpdateSchema)) dto: CogsRuleUpdate,
  ): Promise<CogsRuleSummary> {
    return this.cogs.update(org.id, storeId, id, dto);
  }

  @Delete("cogs/:id")
  @Roles(...EDIT_ROLES)
  @HttpCode(204)
  removeCogs(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.cogs.remove(org.id, storeId, id);
  }

  @Post("cogs/import")
  @Roles(...EDIT_ROLES)
  importCogs(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
    @Body(new ZodValidationPipe(cogsCsvImportSchema)) dto: CogsCsvImportInput,
  ): Promise<CogsCsvImportResult> {
    return this.cogs.importCsv(org.id, storeId, dto);
  }

  // ---- Kargo ----

  @Get("shipping")
  listShipping(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
  ): Promise<ShippingRuleSummary[]> {
    return this.rules.listShipping(org.id, storeId);
  }

  @Post("shipping")
  @Roles(...EDIT_ROLES)
  createShipping(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
    @Body(new ZodValidationPipe(shippingRuleInputSchema)) dto: ShippingRuleInput,
  ): Promise<ShippingRuleSummary> {
    return this.rules.createShipping(org.id, storeId, dto);
  }

  @Patch("shipping/:id")
  @Roles(...EDIT_ROLES)
  updateShipping(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(shippingRuleInputSchema)) dto: ShippingRuleInput,
  ): Promise<ShippingRuleSummary> {
    return this.rules.updateShipping(org.id, storeId, id, dto);
  }

  @Delete("shipping/:id")
  @Roles(...EDIT_ROLES)
  @HttpCode(204)
  removeShipping(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.rules.removeShipping(org.id, storeId, id);
  }

  // ---- Ödeme ücretleri ----

  @Get("payment-fees")
  listPaymentFees(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
  ): Promise<PaymentFeeRuleSummary[]> {
    return this.rules.listPaymentFees(org.id, storeId);
  }

  @Post("payment-fees")
  @Roles(...EDIT_ROLES)
  createPaymentFee(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
    @Body(new ZodValidationPipe(paymentFeeRuleInputSchema))
    dto: PaymentFeeRuleInput,
  ): Promise<PaymentFeeRuleSummary> {
    return this.rules.createPaymentFee(org.id, storeId, dto);
  }

  @Patch("payment-fees/:id")
  @Roles(...EDIT_ROLES)
  updatePaymentFee(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(paymentFeeRuleInputSchema))
    dto: PaymentFeeRuleInput,
  ): Promise<PaymentFeeRuleSummary> {
    return this.rules.updatePaymentFee(org.id, storeId, id, dto);
  }

  @Delete("payment-fees/:id")
  @Roles(...EDIT_ROLES)
  @HttpCode(204)
  removePaymentFee(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.rules.removePaymentFee(org.id, storeId, id);
  }

  // ---- Vergi config ----

  @Get("tax")
  getTax(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
  ): Promise<TaxConfigSummary> {
    return this.rules.getTaxConfig(org.id, storeId);
  }

  @Put("tax")
  @Roles(...EDIT_ROLES)
  upsertTax(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
    @Body(new ZodValidationPipe(taxConfigInputSchema)) dto: TaxConfigInput,
  ): Promise<TaxConfigSummary> {
    return this.rules.upsertTaxConfig(org.id, storeId, dto);
  }

  // ---- Maliyet çözümleme (debug / iç doğrulama) ----

  @Get("resolve")
  async resolve(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
    @Query(new ZodValidationPipe(costResolveQuerySchema)) query: CostResolveQuery,
  ): Promise<CostResolution> {
    await this.resolver.assertStore(org.id, storeId); // org-sahiplik (404 atar)
    return this.resolver.resolveAll({
      storeId,
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
