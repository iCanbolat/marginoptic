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
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  acceptInviteSchema,
  createOrgSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  type AcceptInviteInput,
  type CreateOrgInput,
  type InvitationCreatedResponse,
  type InviteMemberInput,
  type OrgSummary,
  type UpdateMemberRoleInput,
} from "@churnify/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthContext } from "../auth/auth.types";
import {
  type ActiveOrg,
  CurrentOrg,
} from "../auth/decorators/current-org.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { InvitationsService } from "./invitations.service";
import { OrganizationsService } from "./organizations.service";

@ApiTags("organizations")
@ApiBearerAuth()
@Controller("organizations")
export class OrganizationsController {
  constructor(
    private readonly orgs: OrganizationsService,
    private readonly invites: InvitationsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthContext): Promise<OrgSummary[]> {
    return this.orgs.listForUser(user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(createOrgSchema)) dto: CreateOrgInput,
  ): Promise<OrgSummary> {
    return this.orgs.createForOwner(user.userId, dto.name);
  }

  @Get("members")
  @Roles("owner", "admin", "analyst", "viewer")
  members(@CurrentOrg() org: ActiveOrg) {
    return this.orgs.listMembers(org.id);
  }

  @Patch("members/:userId/role")
  @Roles("owner", "admin")
  async updateRole(
    @CurrentOrg() org: ActiveOrg,
    @Param("userId") targetUserId: string,
    @Body(new ZodValidationPipe(updateMemberRoleSchema)) dto: UpdateMemberRoleInput,
  ) {
    await this.orgs.updateMemberRole(org.id, targetUserId, dto.role);
    return { ok: true };
  }

  @Delete("members/:userId")
  @Roles("owner", "admin")
  @HttpCode(204)
  async removeMember(
    @CurrentUser() user: AuthContext,
    @CurrentOrg() org: ActiveOrg,
    @Param("userId") targetUserId: string,
  ): Promise<void> {
    await this.orgs.removeMember(org.id, user.userId, targetUserId);
  }

  @Get("invitations")
  @Roles("owner", "admin")
  listInvites(@CurrentOrg() org: ActiveOrg) {
    return this.invites.listPending(org.id);
  }

  @Post("invitations")
  @Roles("owner", "admin")
  async invite(
    @CurrentUser() user: AuthContext,
    @CurrentOrg() org: ActiveOrg,
    @Body(new ZodValidationPipe(inviteMemberSchema)) dto: InviteMemberInput,
  ): Promise<InvitationCreatedResponse> {
    const { inv, raw } = await this.invites.create(
      org.id,
      dto.email,
      dto.role,
      user.userId,
    );
    const base = this.config.get<string>("WEB_ORIGIN") ?? "http://localhost:5173";
    return {
      id: inv.id,
      email: inv.email,
      role: inv.role,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
      acceptUrl: `${base}/invite/accept?token=${raw}`,
    };
  }

  @Post("invitations/accept")
  async accept(
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(acceptInviteSchema)) dto: AcceptInviteInput,
  ): Promise<OrgSummary> {
    const orgId = await this.invites.accept(dto.token, user.userId, user.email);
    const role = await this.orgs.getRole(user.userId, orgId);
    const org = await this.orgs.getById(orgId);
    if (!org || !role) {
      throw new Error("Davet kabul edilemedi");
    }
    return { id: org.id, name: org.name, slug: org.slug, role };
  }
}
