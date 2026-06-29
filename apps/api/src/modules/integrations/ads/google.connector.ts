import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  AdAuthUrlParams,
  AdConnector,
  AdEntityRow,
  AdExchangeParams,
  AdInsightsParams,
  AdInsightsResult,
  AdSpendRow,
  ProductAdSpendRow,
} from "./ad-connector.types";
import { microsToMoney, toFixed4, toInt } from "./ad-report.util";
import type { TokenSet } from "../connector.types";

const API_VERSION = "v17";
const API_BASE = `https://googleads.googleapis.com/${API_VERSION}`;
const ADWORDS_SCOPE = "https://www.googleapis.com/auth/adwords";

/** Google Ads REST yanıt satırı (searchStream — camelCase alanlar). */
interface GaqlRow {
  campaign?: { id?: string; name?: string; status?: string };
  segments?: { date?: string; productItemId?: string };
  metrics?: {
    costMicros?: string;
    impressions?: string;
    clicks?: string;
    conversions?: number;
    conversionsValue?: number;
  };
}

/**
 * Google Ads connector — OAuth2 (offline access) + Google Ads API (GAQL).
 * Canlı `fetchInsights` campaign-level harcamayı `campaign` raporundan, ürün-seviyesi
 * harcamayı `shopping_performance_view`'dan (Shopping kampanyaları) çeker. Hesap
 * kimliği (customerId) token taşımadığından bağlanma anında `listAccessibleCustomers`
 * ile çözülür. Dev (`dev_` token) yolu sentetik veri kullanır.
 */
@Injectable()
export class GoogleAdsConnector implements AdConnector {
  readonly provider = "google_ads" as const;
  private readonly logger = new Logger(GoogleAdsConnector.name);

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
    url.searchParams.set("scope", ADWORDS_SCOPE);
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
    // Hesap kimliğini çöz (developer token gerekir; yoksa null → callback hata verir).
    const customerId = await this.resolveCustomerId(data.access_token).catch(
      () => null,
    );
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null,
      scopes: ADWORDS_SCOPE,
      externalAccountId: customerId,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenSet> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.getOrThrow<string>("GOOGLE_ADS_CLIENT_ID"),
        client_secret: this.config.getOrThrow<string>("GOOGLE_ADS_CLIENT_SECRET"),
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) {
      throw new Error(`Google token yenileme başarısız (${res.status})`);
    }
    const data = (await res.json()) as {
      access_token: string;
      expires_in?: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken, // Google refresh akışı yeni refresh token döndürmez.
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null,
      scopes: ADWORDS_SCOPE,
    };
  }

  async fetchInsights({
    accessToken,
    externalAccountId,
    since,
    until,
  }: AdInsightsParams): Promise<AdInsightsResult> {
    const developerToken = this.config.getOrThrow<string>(
      "GOOGLE_ADS_DEVELOPER_TOKEN",
    );
    const customerId = externalAccountId.replace(/-/g, "");
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": developerToken,
      "Content-Type": "application/json",
    };
    const loginCustomerId = this.config.get<string>(
      "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
    );
    if (loginCustomerId) {
      headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");
    }

    // Campaign-level harcama.
    const campaignRows = await this.searchStream(
      customerId,
      `SELECT campaign.id, campaign.name, campaign.status, segments.date, ` +
        `metrics.cost_micros, metrics.impressions, metrics.clicks, ` +
        `metrics.conversions, metrics.conversions_value FROM campaign ` +
        `WHERE segments.date BETWEEN '${since}' AND '${until}'`,
      headers,
    );
    const spend: AdSpendRow[] = [];
    const campaigns = new Map<string, AdEntityRow>();
    for (const r of campaignRows) {
      const id = r.campaign?.id;
      const date = r.segments?.date;
      if (!id || !date) continue;
      spend.push({
        date,
        level: "campaign",
        entityExternalId: id,
        campaignExternalId: id,
        name: r.campaign?.name ?? null,
        spend: microsToMoney(r.metrics?.costMicros),
        impressions: toInt(r.metrics?.impressions),
        clicks: toInt(r.metrics?.clicks),
        conversions: toFixed4(r.metrics?.conversions),
        conversionValue: toFixed4(r.metrics?.conversionsValue),
        currency: null,
      });
      if (!campaigns.has(id)) {
        campaigns.set(id, {
          level: "campaign",
          externalId: id,
          name: r.campaign?.name ?? null,
          parentExternalId: null,
          campaignExternalId: id,
          status: r.campaign?.status ?? null,
          currency: null,
        });
      }
    }

    // Ürün-seviyesi harcama (Shopping kampanyaları). Yoksa boş kalır (blended fallback).
    const productSpend: ProductAdSpendRow[] = [];
    try {
      const productRows = await this.searchStream(
        customerId,
        `SELECT segments.product_item_id, segments.date, metrics.cost_micros, ` +
          `metrics.clicks, metrics.conversions, metrics.conversions_value ` +
          `FROM shopping_performance_view ` +
          `WHERE segments.date BETWEEN '${since}' AND '${until}'`,
        headers,
      );
      for (const r of productRows) {
        const pid = r.segments?.productItemId;
        const date = r.segments?.date;
        if (!pid || !date) continue;
        productSpend.push({
          date,
          productExternalId: pid,
          spend: microsToMoney(r.metrics?.costMicros),
          clicks: toInt(r.metrics?.clicks),
          conversions: toFixed4(r.metrics?.conversions),
          conversionValue: toFixed4(r.metrics?.conversionsValue),
        });
      }
    } catch (err) {
      this.logger.warn(
        `Google Shopping ürün raporu atlandı (${customerId}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    this.logger.log(
      `Google Ads ${customerId} ${since}→${until}: ${spend.length} satır / ${productSpend.length} ürün`,
    );
    return { entities: [...campaigns.values()], spend, productSpend };
  }

  /** GAQL sorgusunu searchStream ile çalıştırır; akış parçalarını düzleştirir. */
  private async searchStream(
    customerId: string,
    query: string,
    headers: Record<string, string>,
  ): Promise<GaqlRow[]> {
    const res = await fetch(
      `${API_BASE}/customers/${customerId}/googleAds:searchStream`,
      { method: "POST", headers, body: JSON.stringify({ query }) },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Google Ads searchStream başarısız (${res.status}) ${text.slice(0, 200)}`,
      );
    }
    const body = (await res.json()) as { results?: GaqlRow[] }[];
    const out: GaqlRow[] = [];
    for (const chunk of body ?? []) {
      for (const row of chunk.results ?? []) out.push(row);
    }
    return out;
  }

  /** Erişilebilir ilk customer kimliğini çözer (developer token yoksa null). */
  private async resolveCustomerId(accessToken: string): Promise<string | null> {
    const developerToken = this.config.get<string>("GOOGLE_ADS_DEVELOPER_TOKEN");
    if (!developerToken) return null;
    const res = await fetch(`${API_BASE}/customers:listAccessibleCustomers`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
      },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { resourceNames?: string[] };
    const first = body.resourceNames?.[0];
    return first ? (first.split("/")[1] ?? null) : null;
  }
}
