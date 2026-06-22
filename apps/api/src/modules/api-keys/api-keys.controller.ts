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
  type ActiveOrg,
  CurrentOrg,
} from "../auth/decorators/current-org.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
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
  @Roles("owner", "admin")
  list(@CurrentOrg() org: ActiveOrg): Promise<ApiKeySummary[]> {
    return this.apiKeys.list(org.id);
  }

  @Post()
  @Roles("owner", "admin")
  create(
    @CurrentOrg() org: ActiveOrg,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(apiKeyCreateSchema)) dto: ApiKeyCreateInput,
  ): Promise<ApiKeyCreatedResponse> {
    return this.apiKeys.create(org.id, user.userId, dto);
  }

  @Delete(":id")
  @Roles("owner", "admin")
  @HttpCode(204)
  revoke(
    @CurrentOrg() org: ActiveOrg,
    @Param("id") id: string,
  ): Promise<void> {
    return this.apiKeys.revoke(org.id, id);
  }
}
