import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface GoogleProfile {
  /** Google "sub" — kalıcı, benzersiz kullanıcı kimliği. */
  sub: string;
  email: string;
  name: string;
}

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const SCOPES = "openid email profile";

/**
 * Google sosyal-login connector (OAuth2 authorization code).
 *
 * eBay/Shopify connector'ları gibi ham `fetch` kullanır; passport-google eklenmez.
 * `GOOGLE_OAUTH_CLIENT_ID` yoksa `isConfigured` false → /auth/google/start 400 döner.
 */
@Injectable()
export class GoogleConnector {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>("GOOGLE_OAUTH_CLIENT_ID"));
  }

  private get clientId(): string {
    return this.config.getOrThrow<string>("GOOGLE_OAUTH_CLIENT_ID");
  }

  private get clientSecret(): string {
    return this.config.getOrThrow<string>("GOOGLE_OAUTH_CLIENT_SECRET");
  }

  buildAuthUrl(params: { state: string; redirectUri: string }): string {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", params.state);
    url.searchParams.set("access_type", "online");
    // Her seferinde hesap seçtir (paylaşılan cihazda yanlış hesap riskini azaltır).
    url.searchParams.set("prompt", "select_account");
    return url.toString();
  }

  /** Authorization code → access token. */
  async exchangeCode(params: {
    code: string;
    redirectUri: string;
  }): Promise<string> {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: params.code,
        redirect_uri: params.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }).toString(),
    });
    if (!res.ok) {
      throw new Error(`Google token değişimi başarısız (${res.status})`);
    }
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new Error("Google access token alınamadı");
    return data.access_token;
  }

  /** Access token → kullanıcı profili (sub/email/name). */
  async fetchProfile(accessToken: string): Promise<GoogleProfile> {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Google profil çözümü başarısız (${res.status})`);
    }
    const data = (await res.json()) as {
      sub?: string;
      email?: string;
      name?: string;
    };
    if (!data.sub || !data.email) {
      throw new Error("Google profilinde sub/email eksik");
    }
    return {
      sub: data.sub,
      email: data.email.toLowerCase(),
      name: data.name?.trim() || data.email,
    };
  }
}
