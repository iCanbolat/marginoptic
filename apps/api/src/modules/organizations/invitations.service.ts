import { createHash, randomBytes } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import type { InvitationView, Role } from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import {
  invitations,
  memberships,
  users,
} from "../../database/schema/auth";

const INVITE_TTL_DAYS = 7;

export type InvitationRow = typeof invitations.$inferSelect;

@Injectable()
export class InvitationsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private hash(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }

  async create(
    orgId: string,
    email: string,
    role: Exclude<Role, "owner">,
    invitedByUserId: string,
  ): Promise<{ inv: InvitationRow; raw: string }> {
    const normalized = email.toLowerCase();

    const [existing] = await this.db
      .select({ id: memberships.id })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.organizationId, orgId),
          eq(users.email, normalized),
        ),
      )
      .limit(1);
    if (existing) throw new BadRequestException("Bu e-posta zaten üye");

    const raw = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
    const [inv] = await this.db
      .insert(invitations)
      .values({
        organizationId: orgId,
        email: normalized,
        role,
        tokenHash: this.hash(raw),
        invitedByUserId,
        expiresAt,
      })
      .returning();
    return { inv, raw };
  }

  async listPending(orgId: string): Promise<InvitationView[]> {
    const rows = await this.db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.organizationId, orgId),
          isNull(invitations.acceptedAt),
        ),
      )
      .orderBy(invitations.createdAt);
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      expiresAt: r.expiresAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Daveti kabul eder; üyelik oluşturur. Davetli organizasyon id'sini döner. */
  async accept(
    rawToken: string,
    userId: string,
    userEmail: string,
  ): Promise<string> {
    const [inv] = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, this.hash(rawToken)))
      .limit(1);

    if (!inv || inv.acceptedAt) throw new NotFoundException("Davet geçersiz");
    if (inv.expiresAt.getTime() < Date.now())
      throw new BadRequestException("Davet süresi doldu");
    if (inv.email !== userEmail.toLowerCase())
      throw new ForbiddenException("Davet bu hesaba ait değil");

    await this.db.transaction(async (tx) => {
      await tx
        .insert(memberships)
        .values({
          organizationId: inv.organizationId,
          userId,
          role: inv.role,
        })
        .onConflictDoUpdate({
          target: [memberships.organizationId, memberships.userId],
          set: { role: inv.role },
        });
      await tx
        .update(invitations)
        .set({ acceptedAt: new Date() })
        .where(eq(invitations.id, inv.id));
    });

    return inv.organizationId;
  }
}
