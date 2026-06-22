import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  AdAuthUrlParams,
  AdConnector,
  AdExchangeParams,
  AdInsightsParams,
  AdInsightsResult,
} from "./ad-connector.types";
import type { TokenSet } from "../connector.types";

/**
 * Google Ads connector — OAuth2 (offline access). Canlı `fetchInsights` (GAQL +
 * developer token) Faz 9'a bırakıldı; dev-connect ile sentetik veri üzerinden
 * tüm hat (ad_spend → rollup → ROAS/POAS) doğrulanır.
 */
@Injectable()
export class GoogleAdsConnector implements AdConnector {
  readonly provider = "google_ads" as const;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return (
      !!this.config.get<string>("GOOGLE_ADS_CLIENT_ID") &&
      !!this.config.get<string>("GOOGLE_ADS_CLIENT_SECRET")
    );
  }

  buildAuthUrl({ state, redirectUri }: AdAuthUrlParams): string {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set(
      "client_id",
      this.config.getOrThrow<string>("GOOGLE_ADS_CLIENT_ID"),
    );
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "https://www.googleapis.com/auth/adwords");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode({ code, redirectUri }: AdExchangeParams): Promise<TokenSet> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.getOrThrow<string>("GOOGLE_ADS_CLIENT_ID"),
        client_secret: this.config.getOrThrow<string>("GOOGLE_ADS_CLIENT_SECRET"),
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code,
      }),
    });
    if (!res.ok) {
      throw new Error(`Google token değişimi başarısız (${res.status})`);
    }
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null,
      scopes: "https://www.googleapis.com/auth/adwords",
    };
  }

  fetchInsights(_params: AdInsightsParams): Promise<AdInsightsResult> {
    // Canlı GAQL çekimi Faz 9'da; dev-connect (sentetik) ile pipeline doğrulanır.
    return Promise.reject(
      new Error("Google Ads canlı insight çekimi henüz uygulanmadı (Faz 9)"),
    );
  }
}
