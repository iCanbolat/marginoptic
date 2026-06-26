import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { and, eq, isNull } from "drizzle-orm";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { refreshTokens } from "../../database/schema/auth";
import type { JwtPayload } from "./auth.types";

const REFRESH_TTL_DAYS = 30;
const ACCESS_TTL = "15m";

export interface RotationResult {
  userId: string;
  activeStoreId: string | null;
  newRaw: string;
}

@Injectable()
export class TokenService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccessToken(payload: JwtPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: ACCESS_TTL,
    });
  }

  private hash(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }

  async issueRefreshToken(
    userId: string,
    activeStoreId: string | null,
    familyId?: string,
  ): Promise<string> {
    const raw = randomBytes(32).toString("base64url");
    await this.db.insert(refreshTokens).values({
      userId,
      tokenHash: this.hash(raw),
      familyId: familyId ?? randomUUID(),
      activeStoreId,
      expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000),
    });
    return raw;
  }

  /** Rotation + reuse-detection: iptal edilmiş token sunulursa tüm aile iptal edilir. */
  async rotateRefreshToken(raw: string): Promise<RotationResult> {
    const [row] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, this.hash(raw)))
      .limit(1);

    if (!row) throw new UnauthorizedException("Geçersiz oturum");
    if (row.revokedAt) {
      await this.revokeFamily(row.familyId);
      throw new UnauthorizedException("Oturum yeniden kullanıldı; iptal edildi");
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Oturum süresi doldu");
    }

    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, row.id));

    const newRaw = await this.issueRefreshToken(
      row.userId,
      row.activeStoreId,
      row.familyId,
    );
    return { userId: row.userId, activeStoreId: row.activeStoreId, newRaw };
  }

  async revokeByRaw(raw: string): Promise<void> {
    const [row] = await this.db
      .select({ familyId: refreshTokens.familyId })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, this.hash(raw)))
      .limit(1);
    if (row) await this.revokeFamily(row.familyId);
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.familyId, familyId),
          isNull(refreshTokens.revokedAt),
        ),
      );
  }

  /** Org switch — geçerli refresh kaydının aktif org'unu günceller. */
  async setActiveStore(raw: string, storeId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ activeStoreId: storeId })
      .where(eq(refreshTokens.tokenHash, this.hash(raw)));
  }
}
