import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { StoreSummary } from "@churnify/shared";
import {
  type ActiveOrg,
  CurrentOrg,
} from "../auth/decorators/current-org.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { StoresService } from "./stores.service";

@ApiTags("stores")
@ApiBearerAuth()
@Controller("stores")
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get()
  list(@CurrentOrg() org: ActiveOrg): Promise<StoreSummary[]> {
    return this.stores.listForOrg(org.id);
  }

  @Get(":id")
  get(
    @CurrentOrg() org: ActiveOrg,
    @Param("id") id: string,
  ): Promise<StoreSummary> {
    return this.stores.getForOrg(org.id, id);
  }

  @Delete(":id")
  @Roles("owner", "admin")
  @HttpCode(204)
  disconnect(
    @CurrentOrg() org: ActiveOrg,
    @Param("id") id: string,
  ): Promise<void> {
    return this.stores.disconnect(org.id, id);
  }
}
