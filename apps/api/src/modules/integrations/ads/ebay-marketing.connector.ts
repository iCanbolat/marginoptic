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
 * eBay Marketing connector — eBay OAuth2 + Marketing API (Promoted Listings
 * kampanyaları). Promoted Listings raporu listing (ürün) bazında olduğundan
 * `fetchInsights` ürün-seviyesi harcamayı (`productSpend`) listing id ile
 * döndürebilir. Canlı rapor çekimi yapılandırılmış creds gerektirir; dev-connect
 * (sentetik) ile tüm hat doğrulanır.
 */
@Injectable()
export class EbayMarketingConnector implements AdConnector {
  readonly provider = "ebay_ads" as const;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return (
      !!this.config.get<string>("EBAY_ADS_CLIENT_ID") &&
      !!this.config.get<string>("EBAY_ADS_CLIENT_SECRET")
    );
  }

  buildAuthUrl({ state, redirectUri }: AdAuthUrlParams): string {
    const url = new URL("https://auth.ebay.com/oauth2/authorize");
    url.searchParams.set(
      "client_id",
      this.config.getOrThrow<string>("EBAY_ADS_CLIENT_ID"),
    );
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set(
      "scope",
      "https://api.ebay.com/oauth/api_scope/sell.marketing.readonly",
    );
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode({ code, redirectUri }: AdExchangeParams): Promise<TokenSet> {
    const basic = Buffer.from(
      `${this.config.getOrThrow<string>("EBAY_ADS_CLIENT_ID")}:${this.config.getOrThrow<string>("EBAY_ADS_CLIENT_SECRET")}`,
    ).toString("base64");
    const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) {
      throw new Error(`eBay Marketing token değişimi başarısız (${res.status})`);
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
      scopes: "sell.marketing.readonly",
    };
  }

  fetchInsights(_params: AdInsightsParams): Promise<AdInsightsResult> {
    // Canlı Promoted Listings raporu yapılandırma gerektirir; dev-connect
    // (sentetik) ile pipeline + ürün-seviyesi atıf doğrulanır.
    return Promise.reject(
      new Error("eBay Marketing canlı rapor çekimi henüz uygulanmadı"),
    );
  }
}
