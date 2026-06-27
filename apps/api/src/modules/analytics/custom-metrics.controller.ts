import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  analyticsFilterSchema,
  customMetricCreateSchema,
  customMetricUpdateSchema,
  type AnalyticsFilter,
  type CustomMetricCreateInput,
  type CustomMetricSummary,
  type CustomMetricUpdateInput,
  type CustomMetricValuesResponse,
} from "@churnify/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequiresFeature } from "../auth/decorators/requires-feature.decorator";
import {
  type ActiveStore,
  CurrentStore,
} from "../auth/decorators/current-store.decorator";
import { RequiresFeatureGuard } from "../auth/guards/requires-feature.guard";
import { BillingService } from "../billing/billing.service";
import { CustomMetricsService } from "./custom-metrics.service";
import { clampFromToLookback } from "./lookback.util";

/**
 * Özel metrikler — Pro plana özel (`@RequiresFeature("customMetrics")`).
 * Tüm uçlar plan özellik haritasına göre korunur.
 */
@ApiTags("custom-metrics")
@ApiBearerAuth()
@UseGuards(RequiresFeatureGuard)
@RequiresFeature("customMetrics")
@Controller("custom-metrics")
export class CustomMetricsController {
  constructor(
    private readonly metrics: CustomMetricsService,
    private readonly billing: BillingService,
  ) {}

  @Get()
  list(@CurrentStore() org: ActiveStore): Promise<CustomMetricSummary[]> {
    return this.metrics.list(org.id);
  }

  /** Org özel metriklerini verilen aralık/mağazalar için değerlendirir. */
  @Get("values")
  async values(
    @CurrentStore() org: ActiveStore,
    @Query(new ZodValidationPipe(analyticsFilterSchema))
    filter: AnalyticsFilter,
  ): Promise<CustomMetricValuesResponse> {
    const days = await this.billing.lookbackDaysForStore(org.id);
    return this.metrics.values(org.id, {
      ...filter,
      from: clampFromToLookback(filter.from, days),
    });
  }

  @Post()
  create(
    @CurrentStore() org: ActiveStore,
    @Body(new ZodValidationPipe(customMetricCreateSchema))
    dto: CustomMetricCreateInput,
  ): Promise<CustomMetricSummary> {
    return this.metrics.create(org.id, dto);
  }

  @Patch(":id")
  update(
    @CurrentStore() org: ActiveStore,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(customMetricUpdateSchema))
    dto: CustomMetricUpdateInput,
  ): Promise<CustomMetricSummary> {
    return this.metrics.update(org.id, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @CurrentStore() org: ActiveStore,
    @Param("id") id: string,
  ): Promise<void> {
    return this.metrics.remove(org.id, id);
  }
}
