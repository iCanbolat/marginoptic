import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { ChannelSummary } from "@churnify/shared";
import {
  type ActiveStore,
  CurrentStore,
} from "../auth/decorators/current-store.decorator";
import { ChannelsService } from "./channels.service";

@ApiTags("channels")
@ApiBearerAuth()
@Controller("channels")
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Get()
  list(@CurrentStore() org: ActiveStore): Promise<ChannelSummary[]> {
    return this.channels.listForOrg(org.id);
  }

  @Get(":id")
  get(
    @CurrentStore() org: ActiveStore,
    @Param("id") id: string,
  ): Promise<ChannelSummary> {
    return this.channels.getForOrg(org.id, id);
  }

  @Delete(":id")
  @HttpCode(204)
  disconnect(
    @CurrentStore() org: ActiveStore,
    @Param("id") id: string,
  ): Promise<void> {
    return this.channels.disconnect(org.id, id);
  }
}
