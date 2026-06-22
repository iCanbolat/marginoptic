import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type {
  LoginInput,
  OrgSummary,
  RegisterInput,
  SessionResponse,
} from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import {
  memberships,
  organizations,
  users,
} from "../../database/schema/auth";
import { slugify } from "../organizations/slug.util";
import { OrganizationsService } from "../organizations/organizations.service";
import { UsersService, type UserRow } from "../users/users.service";
import { TokenService } from "./token.service";

export interface IssuedSession {
  session: SessionResponse;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly users: UsersService,
    private readonly orgs: OrganizationsService,
    private readonly tokens: TokenService,
  ) {}

  async register(input: RegisterInput): Promise<IssuedSession> {
    const email = input.email.toLowerCase();
    if (await this.users.findByEmail(email)) {
      throw new ConflictException("Bu e-posta ile bir hesap zaten var");
    }
    const passwordHash = await argonHash(input.password);
    const orgName =
      input.organizationName?.trim() || `${input.name} Organizasyonu`;

    const { user, org } = await this.db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({ email, passwordHash, name: input.name })
        .returning();
      const [o] = await tx
        .insert(organizations)
        .values({ name: orgName, slug: slugify(orgName) })
        .returning();
      await tx
        .insert(memberships)
        .values({ organizationId: o.id, userId: u.id, role: "owner" });
      return { user: u, org: o };
    });

    const activeOrg: OrgSummary = {
      id: org.id,
      name: org.name,
      slug: org.slug,
      role: "owner",
    };
    return this.buildSession(user, activeOrg);
  }

  async login(input: LoginInput): Promise<IssuedSession> {
    const user = await this.users.findByEmail(input.email);
    const ok = user && (await argonVerify(user.passwordHash, input.password));
    if (!user || !ok) {
      throw new UnauthorizedException("E-posta veya parola hatalı");
    }
    const orgs = await this.orgs.listForUser(user.id);
    return this.buildSession(user, orgs[0] ?? null);
  }

  async refresh(rawRefresh: string): Promise<IssuedSession> {
    const { userId, activeOrgId, newRaw } =
      await this.tokens.rotateRefreshToken(rawRefresh);
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException("Oturum geçersiz");

    const activeOrg = await this.resolveActiveOrg(userId, activeOrgId);
    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      email: user.email,
      org: activeOrg ? { id: activeOrg.id, role: activeOrg.role } : undefined,
    });
    return {
      session: { accessToken, user: toAuthUser(user), activeOrg },
      refreshToken: newRaw,
    };
  }

  async logout(rawRefresh: string): Promise<void> {
    await this.tokens.revokeByRaw(rawRefresh);
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return {
      user: toAuthUser(user),
      organizations: await this.orgs.listForUser(userId),
    };
  }

  async switchOrg(
    userId: string,
    orgId: string,
    rawRefresh: string | null,
  ): Promise<{ accessToken: string; activeOrg: OrgSummary }> {
    const role = await this.orgs.getRole(userId, orgId);
    if (!role) throw new UnauthorizedException("Bu organizasyona erişiminiz yok");
    if (rawRefresh) await this.tokens.setActiveOrg(rawRefresh, orgId);

    const org = await this.orgs.getById(orgId);
    const user = await this.users.findById(userId);
    if (!org || !user) throw new UnauthorizedException();

    const activeOrg: OrgSummary = {
      id: org.id,
      name: org.name,
      slug: org.slug,
      role,
    };
    const accessToken = this.tokens.signAccessToken({
      sub: userId,
      email: user.email,
      org: { id: orgId, role },
    });
    return { accessToken, activeOrg };
  }

  private async resolveActiveOrg(
    userId: string,
    preferredOrgId: string | null,
  ): Promise<OrgSummary | null> {
    if (preferredOrgId) {
      const role = await this.orgs.getRole(userId, preferredOrgId);
      const org = role ? await this.orgs.getById(preferredOrgId) : undefined;
      if (org && role) {
        return { id: org.id, name: org.name, slug: org.slug, role };
      }
    }
    const orgs = await this.orgs.listForUser(userId);
    return orgs[0] ?? null;
  }

  private async buildSession(
    user: UserRow,
    activeOrg: OrgSummary | null,
  ): Promise<IssuedSession> {
    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      email: user.email,
      org: activeOrg ? { id: activeOrg.id, role: activeOrg.role } : undefined,
    });
    const refreshToken = await this.tokens.issueRefreshToken(
      user.id,
      activeOrg?.id ?? null,
    );
    return {
      session: { accessToken, user: toAuthUser(user), activeOrg },
      refreshToken,
    };
  }
}

function toAuthUser(user: UserRow) {
  return { id: user.id, email: user.email, name: user.name };
}
