import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  storeNameSchema,
  type StoreNameInput,
  type StoreView,
} from "@churnify/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthContext } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { StoresService } from "./stores.service";

/**
 * Mağaza (store) yönetimi — kullanıcının sahip olduğu mağazaların CRUD'u.
 * Route tabanı tarihsel sebeple `/stores`; UI'da "mağaza" olarak sunulur.
 */
@ApiTags("stores")
@ApiBearerAuth()
@Controller("stores")
export class StoresController {
  constructor(private readonly orgs: StoresService) {}

  @Get()
  list(@CurrentUser() user: AuthContext): Promise<StoreView[]> {
    return this.orgs.listForUser(user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(storeNameSchema)) dto: StoreNameInput,
  ): Promise<StoreView> {
    return this.orgs.createForOwner(user.userId, dto.name);
  }

  @Patch(":id")
  rename(
    @CurrentUser() user: AuthContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(storeNameSchema)) dto: StoreNameInput,
  ): Promise<StoreView> {
    return this.orgs.rename(user.userId, id, dto.name);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthContext,
    @Param("id") id: string,
  ): Promise<void> {
    return this.orgs.deleteForOwner(user.userId, id);
  }
}
