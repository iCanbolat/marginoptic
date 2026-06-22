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
 * TikTok Ads connector — Business API OAuth. Canlı `fetchInsights` (reports/integrated)
 * Faz 9'a bırakıldı; dev-connect ile sentetik veri üzerinden pipeline doğrulanır.
 */
@Injectable()
export class TikTokAdsConnector implements AdConnector {
  readonly provider = "tiktok_ads" as const;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return (
      !!this.config.get<string>("TIKTOK_APP_ID") &&
      !!this.config.get<string>("TIKTOK_APP_SECRET")
    );
  }

  buildAuthUrl({ state, redirectUri }: AdAuthUrlParams): string {
    const url = new URL("https://business-api.tiktok.com/portal/auth");
    url.searchParams.set("app_id", this.config.getOrThrow<string>("TIKTOK_APP_ID"));
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode({ code }: AdExchangeParams): Promise<TokenSet> {
    const res = await fetch(
      "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: this.config.getOrThrow<string>("TIKTOK_APP_ID"),
          secret: this.config.getOrThrow<string>("TIKTOK_APP_SECRET"),
          auth_code: code,
        }),
      },
    );
    if (!res.ok) {
      throw new Error(`TikTok token değişimi başarısız (${res.status})`);
    }
    const body = (await res.json()) as {
      data?: { access_token?: string; advertiser_ids?: string[] };
    };
    const token = body.data?.access_token;
    if (!token) throw new Error("TikTok token yanıtı geçersiz");
    return {
      accessToken: token,
      externalAccountId: body.data?.advertiser_ids?.[0] ?? null,
    };
  }

  fetchInsights(_params: AdInsightsParams): Promise<AdInsightsResult> {
    // Canlı rapor çekimi Faz 9'da; dev-connect (sentetik) ile pipeline doğrulanır.
    return Promise.reject(
      new Error("TikTok Ads canlı insight çekimi henüz uygulanmadı (Faz 9)"),
    );
  }
}
