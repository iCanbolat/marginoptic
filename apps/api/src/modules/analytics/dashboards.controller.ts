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
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  dashboardCreateSchema,
  dashboardUpdateSchema,
  dashboardWidgetsSchema,
  type DashboardCreateInput,
  type DashboardDetail,
  type DashboardSummary,
  type DashboardUpdateInput,
  type DashboardWidgetsInput,
} from "@churnify/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import {
  type ActiveStore,
  CurrentStore,
} from "../auth/decorators/current-store.decorator";
import type { AuthContext } from "../auth/auth.types";
import { DashboardsService } from "./dashboards.service";

/** Pano düzenleme yetkisi: viewer hariç. */
const EDIT_ROLES = ["owner", "admin", "analyst"] as const;

@ApiTags("dashboards")
@ApiBearerAuth()
@Controller("dashboards")
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Get()
  list(@CurrentStore() org: ActiveStore): Promise<DashboardSummary[]> {
    return this.dashboards.list(org.id);
  }

  @Get(":id")
  get(
    @CurrentStore() org: ActiveStore,
    @Param("id") id: string,
  ): Promise<DashboardDetail> {
    return this.dashboards.get(org.id, id);
  }

  @Post()
  create(
    @CurrentStore() org: ActiveStore,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(dashboardCreateSchema))
    dto: DashboardCreateInput,
  ): Promise<DashboardDetail> {
    return this.dashboards.create(org.id, user.userId, dto);
  }

  @Patch(":id")
  update(
    @CurrentStore() org: ActiveStore,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(dashboardUpdateSchema))
    dto: DashboardUpdateInput,
  ): Promise<DashboardDetail> {
    return this.dashboards.update(org.id, id, dto);
  }

  @Put(":id/widgets")
  saveWidgets(
    @CurrentStore() org: ActiveStore,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(dashboardWidgetsSchema))
    dto: DashboardWidgetsInput,
  ): Promise<DashboardDetail> {
    return this.dashboards.saveWidgets(org.id, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @CurrentStore() org: ActiveStore,
    @Param("id") id: string,
  ): Promise<void> {
    return this.dashboards.remove(org.id, id);
  }
}
