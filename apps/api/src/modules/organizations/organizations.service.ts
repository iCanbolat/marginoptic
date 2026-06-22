import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { MemberView, OrgSummary, Role } from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import {
  memberships,
  organizations,
  users,
} from "../../database/schema/auth";
import { slugify } from "./slug.util";

export type OrganizationRow = typeof organizations.$inferSelect;

@Injectable()
export class OrganizationsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async listForUser(userId: string): Promise<OrgSummary[]> {
    return this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
      .where(eq(memberships.userId, userId))
      .orderBy(organizations.createdAt);
  }

  async getRole(userId: string, orgId: string): Promise<Role | null> {
    const [row] = await this.db
      .select({ role: memberships.role })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, userId),
          eq(memberships.organizationId, orgId),
        ),
      )
      .limit(1);
    return row?.role ?? null;
  }

  async getById(orgId: string): Promise<OrganizationRow | undefined> {
    const [row] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    return row;
  }

  async createForOwner(userId: string, name: string): Promise<OrgSummary> {
    const org = await this.db.transaction(async (tx) => {
      const [o] = await tx
        .insert(organizations)
        .values({ name, slug: slugify(name) })
        .returning();
      await tx
        .insert(memberships)
        .values({ organizationId: o.id, userId, role: "owner" });
      return o;
    });
    return { id: org.id, name: org.name, slug: org.slug, role: "owner" };
  }

  async listMembers(orgId: string): Promise<MemberView[]> {
    const rows = await this.db
      .select({
        userId: users.id,
        email: users.email,
        name: users.name,
        role: memberships.role,
        joinedAt: memberships.createdAt,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.organizationId, orgId))
      .orderBy(memberships.createdAt);
    return rows.map((r) => ({ ...r, joinedAt: r.joinedAt.toISOString() }));
  }

  async updateMemberRole(
    orgId: string,
    targetUserId: string,
    role: Exclude<Role, "owner">,
  ): Promise<void> {
    const current = await this.getRole(targetUserId, orgId);
    if (!current) throw new NotFoundException("Üye bulunamadı");
    if (current === "owner")
      throw new ForbiddenException("Owner rolü değiştirilemez");
    await this.db
      .update(memberships)
      .set({ role })
      .where(
        and(
          eq(memberships.organizationId, orgId),
          eq(memberships.userId, targetUserId),
        ),
      );
  }

  async removeMember(
    orgId: string,
    actingUserId: string,
    targetUserId: string,
  ): Promise<void> {
    if (actingUserId === targetUserId)
      throw new ForbiddenException("Kendinizi kaldıramazsınız");
    const current = await this.getRole(targetUserId, orgId);
    if (!current) throw new NotFoundException("Üye bulunamadı");
    if (current === "owner") throw new ForbiddenException("Owner kaldırılamaz");
    await this.db
      .delete(memberships)
      .where(
        and(
          eq(memberships.organizationId, orgId),
          eq(memberships.userId, targetUserId),
        ),
      );
  }
}
