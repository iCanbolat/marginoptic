import { randomBytes } from "node:crypto";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Redis } from "ioredis";
import { REDIS } from "../../redis/redis.module";
import { AuthService, type IssuedSession } from "./auth.service";
import { GoogleConnector } from "./google.connector";

const STATE_PREFIX = "oauth:state:google:";
const STATE_TTL_SECONDS = 600;

/**
 * Google sosyal-login OAuth orkestrasyonu: CSRF state (Redis) + connector + oturum.
 * AuthService'i Redis/connector'a bağlamamak için ayrı; controller bunu kullanır.
 */
@Injectable()
export class GoogleAuthService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: ConfigService,
    private readonly connector: GoogleConnector,
    private readonly auth: AuthService,
  ) {}

  private redirectUri(): string {
    return `${this.config.getOrThrow<string>("APP_URL")}/api/auth/google/callback`;
  }

  /** Authorize URL üret: state üretip Redis'e yaz, connector URL'ini döndür. */
  async createAuthUrl(): Promise<string> {
    if (!this.connector.isConfigured()) {
      throw new BadRequestException(
        "Google girişi yapılandırılmamış (GOOGLE_OAUTH_CLIENT_ID)",
      );
    }
    const state = randomBytes(16).toString("hex");
    await this.redis.set(`${STATE_PREFIX}${state}`, "1", "EX", STATE_TTL_SECONDS);
    return this.connector.buildAuthUrl({
      state,
      redirectUri: this.redirectUri(),
    });
  }

  /** Callback: state doğrula (tek-kullanım), code→profil, find-or-create oturum. */
  async handleCallback(query: Record<string, string>): Promise<IssuedSession> {
    const state = query.state;
    const consumed = state
      ? await this.redis.getdel(`${STATE_PREFIX}${state}`)
      : null;
    if (!consumed) {
      throw new BadRequestException("Geçersiz veya süresi dolmuş state");
    }
    if (!query.code) {
      throw new BadRequestException("Google yetki kodu eksik");
    }
    const accessToken = await this.connector.exchangeCode({
      code: query.code,
      redirectUri: this.redirectUri(),
    });
    const profile = await this.connector.fetchProfile(accessToken);
    return this.auth.loginWithGoogle(profile);
  }
}
