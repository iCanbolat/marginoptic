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
 * Amazon Ads connector — Login with Amazon OAuth2 (offline) + Amazon Advertising
 * API (Sponsored Products raporları). Rapor ASIN/SellerSKU bazında olduğundan
 * `fetchInsights` ürün-seviyesi harcamayı (`productSpend`) doğrudan döndürebilir.
 * Canlı rapor çekimi (v3 reporting, async report) yapılandırılmış creds gerektirir;
 * dev-connect (sentetik) ile tüm hat doğrulanır.
 */
@Injectable()
export class AmazonAdsConnector implements AdConnector {
  readonly provider = "amazon_ads" as const;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return (
      !!this.config.get<string>("AMAZON_ADS_CLIENT_ID") &&
      !!this.config.get<string>("AMAZON_ADS_CLIENT_SECRET")
    );
  }

  buildAuthUrl({ state, redirectUri }: AdAuthUrlParams): string {
    const url = new URL("https://www.amazon.com/ap/oa");
    url.searchParams.set(
      "client_id",
      this.config.getOrThrow<string>("AMAZON_ADS_CLIENT_ID"),
    );
    url.searchParams.set("scope", "advertising::campaign_management");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode({ code, redirectUri }: AdExchangeParams): Promise<TokenSet> {
    const res = await fetch("https://api.amazon.com/auth/o2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: this.config.getOrThrow<string>("AMAZON_ADS_CLIENT_ID"),
        client_secret: this.config.getOrThrow<string>("AMAZON_ADS_CLIENT_SECRET"),
      }),
    });
    if (!res.ok) {
      throw new Error(`Amazon Ads token değişimi başarısız (${res.status})`);
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
      scopes: "advertising::campaign_management",
    };
  }

  fetchInsights(_params: AdInsightsParams): Promise<AdInsightsResult> {
    // Canlı Sponsored Products raporu (v3 async reporting) yapılandırma gerektirir;
    // dev-connect (sentetik) ile pipeline + ürün-seviyesi atıf doğrulanır.
    return Promise.reject(
      new Error("Amazon Ads canlı rapor çekimi henüz uygulanmadı"),
    );
  }
}
