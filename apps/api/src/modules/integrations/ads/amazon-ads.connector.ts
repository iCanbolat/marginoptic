import { gunzipSync } from "node:zlib";
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
import { sleep, toFixed4, toInt, toMoney } from "./ad-report.util";
import type { TokenSet } from "../connector.types";

const ADS_SCOPE = "advertising::campaign_management";
/** Amazon Advertising API bölge endpoint'leri (profil bölgesine göre seçilir). */
const REGION_HOSTS: Record<string, string> = {
  NA: "https://advertising-api.amazon.com",
  EU: "https://advertising-api-eu.amazon.com",
  FE: "https://advertising-api-fe.amazon.com",
};
const CREATE_REPORT_CONTENT_TYPE =
  "application/vnd.createasyncreportrequest.v3+json";
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 60; // ~5 dk üst sınır.

/** Async report status yanıtı (v3). */
interface ReportStatus {
  status?: string; // PENDING | PROCESSING | COMPLETED | FAILED
  url?: string;
}

/**
 * Amazon Ads connector — Login with Amazon OAuth2 + Amazon Advertising API
 * (Sponsored Products v3 asenkron raporlama). Hesap kapsamı `profileId`'dir;
 * bağlanma anında `/v2/profiles` ile (NA/EU/FE denenerek) çözülür ve bölge
 * metadata'ya yazılır. `fetchInsights` campaign raporundan harcamayı,
 * `spAdvertisedProduct` raporundan ASIN-bazlı ürün harcamasını çeker.
 * Dev (`dev_` token) yolu sentetik veri kullanır.
 */
@Injectable()
export class AmazonAdsConnector implements AdConnector {
  readonly provider = "amazon_ads" as const;
  private readonly logger = new Logger(AmazonAdsConnector.name);

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
    url.searchParams.set("scope", ADS_SCOPE);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode({ code, redirectUri }: AdExchangeParams): Promise<TokenSet> {
    const data = await this.lwaToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });
    // Hesap kapsamını (profileId) + bölgeyi çöz (NA/EU/FE).
    const profile = await this.resolveProfile(data.access_token).catch(
      () => null,
    );
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null,
      scopes: ADS_SCOPE,
      externalAccountId: profile?.profileId ?? null,
      metadata: profile ? { region: profile.region } : {},
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenSet> {
    const data = await this.lwaToken({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null,
      scopes: ADS_SCOPE,
    };
  }

  async fetchInsights({
    accessToken,
    externalAccountId,
    since,
    until,
    metadata,
  }: AdInsightsParams): Promise<AdInsightsResult> {
    const region = (metadata?.region as string) ?? "NA";
    const host = REGION_HOSTS[region] ?? REGION_HOSTS.NA;
    const headers: Record<string, string> = {
      "Amazon-Advertising-API-ClientId": this.config.getOrThrow<string>(
        "AMAZON_ADS_CLIENT_ID",
      ),
      "Amazon-Advertising-API-Scope": externalAccountId,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": CREATE_REPORT_CONTENT_TYPE,
    };

    // Campaign-level rapor.
    const campaignRows = await this.runReport(host, headers, since, until, {
      adProduct: "SPONSORED_PRODUCTS",
      groupBy: ["campaign"],
      reportTypeId: "spCampaigns",
      timeUnit: "DAILY",
      format: "GZIP_JSON",
      columns: [
        "date",
        "campaignId",
        "campaignName",
        "cost",
        "impressions",
        "clicks",
        "purchases7d",
        "sales7d",
      ],
    });

    const spend: AdSpendRow[] = [];
    const campaigns = new Map<string, AdEntityRow>();
    for (const r of campaignRows) {
      const id = str(r.campaignId);
      const date = str(r.date);
      if (!id || !date) continue;
      spend.push({
        date,
        level: "campaign",
        entityExternalId: id,
        campaignExternalId: id,
        name: str(r.campaignName),
        spend: toMoney(num(r.cost)),
        impressions: toInt(num(r.impressions)),
        clicks: toInt(num(r.clicks)),
        conversions: toFixed4(num(r.purchases7d)),
        conversionValue: toFixed4(num(r.sales7d)),
        currency: null,
      });
      if (!campaigns.has(id)) {
        campaigns.set(id, {
          level: "campaign",
          externalId: id,
          name: str(r.campaignName),
          parentExternalId: null,
          campaignExternalId: id,
          status: null,
          currency: null,
        });
      }
    }

    // Ürün-seviyesi rapor (ASIN-bazlı; siparişler ASIN ile saklanır → join).
    const productSpend: ProductAdSpendRow[] = [];
    try {
      const productRows = await this.runReport(host, headers, since, until, {
        adProduct: "SPONSORED_PRODUCTS",
        groupBy: ["advertiser"],
        reportTypeId: "spAdvertisedProduct",
        timeUnit: "DAILY",
        format: "GZIP_JSON",
        columns: [
          "date",
          "advertisedAsin",
          "cost",
          "clicks",
          "purchases7d",
          "sales7d",
        ],
      });
      for (const r of productRows) {
        const pid = str(r.advertisedAsin);
        const date = str(r.date);
        if (!pid || !date) continue;
        productSpend.push({
          date,
          productExternalId: pid,
          spend: toMoney(num(r.cost)),
          clicks: toInt(num(r.clicks)),
          conversions: toFixed4(num(r.purchases7d)),
          conversionValue: toFixed4(num(r.sales7d)),
        });
      }
    } catch (err) {
      this.logger.warn(
        `Amazon Ads ürün raporu atlandı: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    this.logger.log(
      `Amazon Ads ${externalAccountId} (${region}) ${since}→${until}: ${spend.length} satır / ${productSpend.length} ürün`,
    );
    return { entities: [...campaigns.values()], spend, productSpend };
  }

  /** LWA token uç noktası (authorization_code / refresh_token). */
  private async lwaToken(
    params: Record<string, string>,
  ): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    const res = await fetch("https://api.amazon.com/auth/o2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        ...params,
        client_id: this.config.getOrThrow<string>("AMAZON_ADS_CLIENT_ID"),
        client_secret: this.config.getOrThrow<string>("AMAZON_ADS_CLIENT_SECRET"),
      }),
    });
    if (!res.ok) {
      throw new Error(`Amazon Ads token işlemi başarısız (${res.status})`);
    }
    return res.json() as Promise<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    }>;
  }

  /** Bölgeleri (NA/EU/FE) deneyerek ilk profili çözer. */
  private async resolveProfile(
    accessToken: string,
  ): Promise<{ profileId: string; region: string } | null> {
    const clientId = this.config.getOrThrow<string>("AMAZON_ADS_CLIENT_ID");
    for (const region of ["NA", "EU", "FE"]) {
      const res = await fetch(`${REGION_HOSTS[region]}/v2/profiles`, {
        headers: {
          "Amazon-Advertising-API-ClientId": clientId,
          Authorization: `Bearer ${accessToken}`,
        },
      }).catch(() => null);
      if (!res || !res.ok) continue;
      const profiles = (await res.json()) as { profileId?: number }[];
      const first = profiles?.[0]?.profileId;
      if (first != null) return { profileId: String(first), region };
    }
    return null;
  }

  /** Asenkron rapor: oluştur → COMPLETED'a dek poll → gzip indir → parse. */
  private async runReport(
    host: string,
    headers: Record<string, string>,
    since: string,
    until: string,
    configuration: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]> {
    const createRes = await fetch(`${host}/reporting/reports`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: `churnify-${configuration.reportTypeId}-${Date.now()}`,
        startDate: since,
        endDate: until,
        configuration,
      }),
    });
    if (!createRes.ok) {
      const t = await createRes.text().catch(() => "");
      throw new Error(
        `Amazon Ads rapor oluşturma başarısız (${createRes.status}) ${t.slice(0, 200)}`,
      );
    }
    const { reportId } = (await createRes.json()) as { reportId?: string };
    if (!reportId) throw new Error("Amazon Ads reportId döndürülmedi");

    const pollHeaders = {
      "Amazon-Advertising-API-ClientId":
        headers["Amazon-Advertising-API-ClientId"],
      "Amazon-Advertising-API-Scope": headers["Amazon-Advertising-API-Scope"],
      Authorization: headers.Authorization,
    };
    let downloadUrl: string | null = null;
    for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const statusRes = await fetch(`${host}/reporting/reports/${reportId}`, {
        headers: pollHeaders,
      });
      if (!statusRes.ok) {
        throw new Error(`Amazon Ads rapor durumu başarısız (${statusRes.status})`);
      }
      const s = (await statusRes.json()) as ReportStatus;
      if (s.status === "COMPLETED") {
        downloadUrl = s.url ?? null;
        break;
      }
      if (s.status === "FAILED") {
        throw new Error("Amazon Ads rapor FAILED durumunda");
      }
    }
    if (!downloadUrl) throw new Error("Amazon Ads rapor zaman aşımına uğradı");

    const dl = await fetch(downloadUrl);
    if (!dl.ok) {
      throw new Error(`Amazon Ads rapor indirme başarısız (${dl.status})`);
    }
    const buf = Buffer.from(await dl.arrayBuffer());
    return JSON.parse(gunzipSync(buf).toString("utf8")) as Record<
      string,
      unknown
    >[];
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : v != null ? String(v) : null;
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}
