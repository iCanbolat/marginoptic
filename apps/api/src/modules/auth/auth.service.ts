import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import type {
  LoginInput,
  RegisterInput,
  SessionResponse,
  StoreView,
} from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { stores, users } from "../../database/schema/auth";
import { BillingService } from "../billing/billing.service";
import { slugify } from "../stores/slug.util";
import { StoresService } from "../stores/stores.service";
import { UsersService, type UserRow } from "../users/users.service";
import type { GoogleProfile } from "./google.connector";
import { TokenService } from "./token.service";

export interface IssuedSession {
  session: SessionResponse;
  refreshToken: string;
}

function toStoreView(row: typeof stores.$inferSelect): StoreView {
  return { id: row.id, name: row.name, slug: row.slug };
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly users: UsersService,
    private readonly orgs: StoresService,
    private readonly tokens: TokenService,
    private readonly billing: BillingService,
  ) {}

  async register(input: RegisterInput): Promise<IssuedSession> {
    const email = input.email.toLowerCase();
    if (await this.users.findByEmail(email)) {
      throw new ConflictException("Bu e-posta ile bir hesap zaten var");
    }
    const passwordHash = await argonHash(input.password);
    const storeName = input.storeName?.trim() || `${input.name} Mağazası`;

    const { user, store } = await this.db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({ email, passwordHash, name: input.name })
        .returning();
      // Açılışta tek varsayılan mağaza (store) — kullanıcı sonradan ekleyebilir.
      const [s] = await tx
        .insert(stores)
        .values({ ownerUserId: u.id, name: storeName, slug: slugify(storeName) })
        .returning();
      return { user: u, store: s };
    });

    return this.buildSession(user, toStoreView(store));
  }

  async login(input: LoginInput): Promise<IssuedSession> {
    const user = await this.users.findByEmail(input.email);
    // Google ile oluşmuş (parolasız) hesapta parola girişi yok.
    if (user && !user.passwordHash) {
      throw new UnauthorizedException(
        "Bu hesap Google ile oluşturulmuş; Google ile giriş yapın",
      );
    }
    const ok =
      user?.passwordHash &&
      (await argonVerify(user.passwordHash, input.password));
    if (!user || !ok) {
      throw new UnauthorizedException("E-posta veya parola hatalı");
    }
    const userStores = await this.orgs.listForUser(user.id);
    return this.buildSession(user, userStores[0] ?? null);
  }

  /**
   * Google sosyal-login. find-or-create:
   *  1) googleId ile bul → giriş.
   *  2) e-posta ile bul → googleId bağla (otomatik eşleme; Google e-postayı doğrular) → giriş.
   *  3) yoksa parolasız kullanıcı + varsayılan mağaza oluştur → giriş.
   */
  async loginWithGoogle(profile: GoogleProfile): Promise<IssuedSession> {
    const byGoogle = await this.users.findByGoogleId(profile.sub);
    if (byGoogle) {
      const userStores = await this.orgs.listForUser(byGoogle.id);
      return this.buildSession(byGoogle, userStores[0] ?? null);
    }

    const byEmail = await this.users.findByEmail(profile.email);
    if (byEmail) {
      const [linked] = await this.db
        .update(users)
        .set({
          googleId: profile.sub,
          emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
        })
        .where(eq(users.id, byEmail.id))
        .returning();
      const userStores = await this.orgs.listForUser(linked.id);
      return this.buildSession(linked, userStores[0] ?? null);
    }

    const storeName = `${profile.name} Mağazası`;
    const { user, store } = await this.db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({
          email: profile.email,
          name: profile.name,
          googleId: profile.sub,
          emailVerifiedAt: new Date(),
        })
        .returning();
      const [s] = await tx
        .insert(stores)
        .values({ ownerUserId: u.id, name: storeName, slug: slugify(storeName) })
        .returning();
      return { user: u, store: s };
    });
    return this.buildSession(user, toStoreView(store));
  }

  async refresh(rawRefresh: string): Promise<IssuedSession> {
    const { userId, activeStoreId, newRaw } =
      await this.tokens.rotateRefreshToken(rawRefresh);
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException("Oturum geçersiz");

    const activeStore = await this.resolveActiveStore(userId, activeStoreId);
    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      email: user.email,
      org: activeStore ? { id: activeStore.id } : undefined,
    });
    return {
      session: { accessToken, user: toAuthUser(user), activeStore },
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
      stores: await this.orgs.listForUser(userId),
      entitlement: await this.billing.entitlementSummary(userId),
    };
  }

  async switchStore(
    userId: string,
    storeId: string,
    rawRefresh: string | null,
  ): Promise<{ accessToken: string; activeStore: StoreView }> {
    const owns = await this.orgs.ownsStore(userId, storeId);
    if (!owns) throw new UnauthorizedException("Bu mağazaya erişiminiz yok");
    if (rawRefresh) await this.tokens.setActiveStore(rawRefresh, storeId);

    const store = await this.orgs.getById(storeId);
    const user = await this.users.findById(userId);
    if (!store || !user) throw new UnauthorizedException();

    const activeStore = toStoreView(store);
    const accessToken = this.tokens.signAccessToken({
      sub: userId,
      email: user.email,
      org: { id: storeId },
    });
    return { accessToken, activeStore };
  }

  private async resolveActiveStore(
    userId: string,
    preferredStoreId: string | null,
  ): Promise<StoreView | null> {
    if (preferredStoreId && (await this.orgs.ownsStore(userId, preferredStoreId))) {
      const store = await this.orgs.getById(preferredStoreId);
      if (store) return toStoreView(store);
    }
    const stores = await this.orgs.listForUser(userId);
    return stores[0] ?? null;
  }

  private async buildSession(
    user: UserRow,
    activeStore: StoreView | null,
  ): Promise<IssuedSession> {
    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      email: user.email,
      org: activeStore ? { id: activeStore.id } : undefined,
    });
    const refreshToken = await this.tokens.issueRefreshToken(
      user.id,
      activeStore?.id ?? null,
    );
    return {
      session: { accessToken, user: toAuthUser(user), activeStore },
      refreshToken,
    };
  }
}

function toAuthUser(user: UserRow) {
  return { id: user.id, email: user.email, name: user.name };
}
