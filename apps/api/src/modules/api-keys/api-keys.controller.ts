import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  apiKeyCreateSchema,
  type ApiKeyCreatedResponse,
  type ApiKeyCreateInput,
  type ApiKeySummary,
} from "@churnify/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthContext } from "../auth/auth.types";
import {
  type ActiveStore,
  CurrentStore,
} from "../auth/decorators/current-store.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ApiKeysService } from "./api-keys.service";

/**
 * Faz 8 — MCP API key yönetimi (org-kapsamlı). Yönetim owner/admin'e kısıtlı:
 * key org genelinde salt-okunur analytics erişimi verir.
 */
@ApiTags("api-keys")
@ApiBearerAuth()
@Controller("api-keys")
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get()
  list(@CurrentStore() org: ActiveStore): Promise<ApiKeySummary[]> {
    return this.apiKeys.list(org.id);
  }

  @Post()
  create(
    @CurrentStore() org: ActiveStore,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(apiKeyCreateSchema)) dto: ApiKeyCreateInput,
  ): Promise<ApiKeyCreatedResponse> {
    return this.apiKeys.create(org.id, user.userId, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  revoke(
    @CurrentStore() org: ActiveStore,
    @Param("id") id: string,
  ): Promise<void> {
    return this.apiKeys.revoke(org.id, id);
  }
}
