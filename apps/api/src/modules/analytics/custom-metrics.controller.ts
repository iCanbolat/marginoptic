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
import {
  type ActiveOrg,
  CurrentOrg,
} from "../auth/decorators/current-org.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { CustomMetricsService } from "./custom-metrics.service";

const EDIT_ROLES = ["owner", "admin", "analyst"] as const;

@ApiTags("custom-metrics")
@ApiBearerAuth()
@Controller("custom-metrics")
export class CustomMetricsController {
  constructor(private readonly metrics: CustomMetricsService) {}

  @Get()
  list(@CurrentOrg() org: ActiveOrg): Promise<CustomMetricSummary[]> {
    return this.metrics.list(org.id);
  }

  /** Org özel metriklerini verilen aralık/mağazalar için değerlendirir. */
  @Get("values")
  values(
    @CurrentOrg() org: ActiveOrg,
    @Query(new ZodValidationPipe(analyticsFilterSchema))
    filter: AnalyticsFilter,
  ): Promise<CustomMetricValuesResponse> {
    return this.metrics.values(org.id, filter);
  }

  @Post()
  @Roles(...EDIT_ROLES)
  create(
    @CurrentOrg() org: ActiveOrg,
    @Body(new ZodValidationPipe(customMetricCreateSchema))
    dto: CustomMetricCreateInput,
  ): Promise<CustomMetricSummary> {
    return this.metrics.create(org.id, dto);
  }

  @Patch(":id")
  @Roles(...EDIT_ROLES)
  update(
    @CurrentOrg() org: ActiveOrg,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(customMetricUpdateSchema))
    dto: CustomMetricUpdateInput,
  ): Promise<CustomMetricSummary> {
    return this.metrics.update(org.id, id, dto);
  }

  @Delete(":id")
  @Roles(...EDIT_ROLES)
  @HttpCode(204)
  remove(
    @CurrentOrg() org: ActiveOrg,
    @Param("id") id: string,
  ): Promise<void> {
    return this.metrics.remove(org.id, id);
  }
}
