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

const MARKETING_SCOPE =
  "https://api.ebay.com/oauth/api_scope/sell.marketing.readonly";
const MARKETING_BASE = "https://api.ebay.com/sell/marketing/v1";
const DEFAULT_MARKETPLACE = "EBAY_US";
const METRIC_KEYS = ["clicks", "impressions", "ad_fees", "sale_amount", "sales"];
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 60; // ~5 dk üst sınır.

/**
 * eBay Marketing connector — eBay OAuth2 + Marketing API (Promoted Listings
 * asenkron ad_report_task). `fetchInsights` campaign raporundan harcamayı,
 * listing raporundan listing-id bazlı ürün harcamasını çeker (siparişler
 * legacyItemId/listing-id ile saklanır → join). Access token ~2s; refresh ile
 * yenilenir. Dev (`dev_` token) yolu sentetik veri kullanır.
 *
 * Not: eBay rapor dosyasındaki kesin kolon adları canlı testte ince ayar
 * gerektirebilir; kolon eşleme (`pick`) büyük/küçük harf ve alt-dize toleranslıdır.
 */
@Injectable()
export class EbayMarketingConnector implements AdConnector {
  readonly provider = "ebay_ads" as const;
  private readonly logger = new Logger(EbayMarketingConnector.name);

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
    url.searchParams.set("scope", MARKETING_SCOPE);
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode({ code, redirectUri }: AdExchangeParams): Promise<TokenSet> {
    const data = await this.identityToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null,
      scopes: "sell.marketing.readonly",
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenSet> {
    const data = await this.identityToken({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: MARKETING_SCOPE,
    });
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null,
      scopes: "sell.marketing.readonly",
    };
  }

  async fetchInsights({
    accessToken,
    since,
    until,
    metadata,
  }: AdInsightsParams): Promise<AdInsightsResult> {
    const marketplaceId =
      (metadata?.marketplaceId as string) ?? DEFAULT_MARKETPLACE;

    // Campaign-level rapor.
    const campaignRows = await this.runReport(
      accessToken,
      "CAMPAIGN_PERFORMANCE_REPORT",
      ["campaign_id", "day"],
      since,
      until,
      marketplaceId,
    );
    const spend: AdSpendRow[] = [];
    const campaigns = new Map<string, AdEntityRow>();
    for (const r of campaignRows) {
      const id = pick(r, ["campaign_id", "campaign id"]);
      const date = normalizeDate(pick(r, ["day", "date"])) ?? until;
      if (!id) continue;
      spend.push({
        date,
        level: "campaign",
        entityExternalId: id,
        campaignExternalId: id,
        name: pick(r, ["campaign_name", "campaign name"]),
        spend: toMoney(pick(r, ["ad_fees", "ad fees", "cost"])),
        impressions: toInt(pick(r, ["impressions"])),
        clicks: toInt(pick(r, ["clicks"])),
        conversions: toFixed4(pick(r, ["sales", "quantity_sold"])),
        conversionValue: toFixed4(pick(r, ["sale_amount", "sales amount"])),
        currency: null,
      });
      if (!campaigns.has(id)) {
        campaigns.set(id, {
          level: "campaign",
          externalId: id,
          name: pick(r, ["campaign_name", "campaign name"]),
          parentExternalId: null,
          campaignExternalId: id,
          status: null,
          currency: null,
        });
      }
    }

    // Listing-level rapor → ürün harcaması (listingId).
    const productSpend: ProductAdSpendRow[] = [];
    try {
      const listingRows = await this.runReport(
        accessToken,
        "LISTING_PERFORMANCE_REPORT",
        ["listing_id", "day"],
        since,
        until,
        marketplaceId,
      );
      for (const r of listingRows) {
        const pid = pick(r, ["listing_id", "listing id", "item_id", "item id"]);
        const date = normalizeDate(pick(r, ["day", "date"])) ?? until;
        if (!pid) continue;
        productSpend.push({
          date,
          productExternalId: pid,
          spend: toMoney(pick(r, ["ad_fees", "ad fees", "cost"])),
          clicks: toInt(pick(r, ["clicks"])),
          conversions: toFixed4(pick(r, ["sales", "quantity_sold"])),
          conversionValue: toFixed4(pick(r, ["sale_amount", "sales amount"])),
        });
      }
    } catch (err) {
      this.logger.warn(
        `eBay listing raporu atlandı: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    this.logger.log(
      `eBay Marketing ${since}→${until}: ${spend.length} satır / ${productSpend.length} ürün`,
    );
    return { entities: [...campaigns.values()], spend, productSpend };
  }

  /** eBay identity token uç noktası (Basic auth ile). */
  private async identityToken(
    params: Record<string, string>,
  ): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    const basic = Buffer.from(
      `${this.config.getOrThrow<string>("EBAY_ADS_CLIENT_ID")}:${this.config.getOrThrow<string>("EBAY_ADS_CLIENT_SECRET")}`,
    ).toString("base64");
    const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams(params),
    });
    if (!res.ok) {
      throw new Error(`eBay Marketing token işlemi başarısız (${res.status})`);
    }
    return res.json() as Promise<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    }>;
  }

  /** Asenkron rapor: task oluştur → COMPLETED'a dek poll → indir → parse. */
  private async runReport(
    token: string,
    reportType: string,
    dimensionKeys: string[],
    since: string,
    until: string,
    marketplaceId: string,
  ): Promise<Record<string, string>[]> {
    const createRes = await fetch(`${MARKETING_BASE}/ad_report_task`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateFrom: since,
        dateTo: until,
        reportType,
        dimensions: dimensionKeys.map((k) => ({ dimensionKey: k })),
        metricKeys: METRIC_KEYS,
        channels: ["ON_SITE"],
        fundingModels: ["COST_PER_SALE"],
        marketplaceIds: [marketplaceId],
      }),
    });
    if (!createRes.ok && createRes.status !== 202) {
      const t = await createRes.text().catch(() => "");
      throw new Error(
        `eBay rapor task oluşturma başarısız (${createRes.status}) ${t.slice(0, 200)}`,
      );
    }
    const location = createRes.headers.get("location");
    const taskId =
      location?.split("/").pop() ??
      ((await createRes.json().catch(() => ({}))) as { adReportTaskId?: string })
        .adReportTaskId;
    if (!taskId) throw new Error("eBay rapor task kimliği döndürülmedi");

    let reportHref: string | null = null;
    for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const st = await fetch(`${MARKETING_BASE}/ad_report_task/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!st.ok) {
        throw new Error(`eBay rapor durumu başarısız (${st.status})`);
      }
      const s = (await st.json()) as { status?: string; reportHref?: string };
      if (s.status === "COMPLETED" || s.status === "SUCCESS") {
        reportHref = s.reportHref ?? null;
        break;
      }
      if (s.status === "FAILED") throw new Error("eBay rapor FAILED durumunda");
    }
    if (!reportHref) throw new Error("eBay rapor zaman aşımına uğradı");

    const dl = await fetch(reportHref, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!dl.ok) throw new Error(`eBay rapor indirme başarısız (${dl.status})`);
    return parseDelimited(await dl.text());
  }
}

/** Sınırlandırılmış (TSV/CSV) rapor metnini başlık-anahtarlı satırlara çevirir. */
function parseDelimited(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const delim = lines[0].includes("\t") ? "\t" : ",";
  const header = lines[0].split(delim).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(delim);
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    return row;
  });
}

/** Başlığı büyük/küçük harf + alt-dize toleranslı eşler. */
function pick(row: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const k = key.toLowerCase();
    for (const col of Object.keys(row)) {
      if (col === k || col.includes(k)) {
        const v = row[col];
        if (v != null && v !== "") return v;
      }
    }
  }
  return null;
}

/** "2024-01-31" / "2024-01-31T..." / "01/31/2024" → YYYY-MM-DD (çözülemezse null). */
function normalizeDate(v: string | null): string | null {
  if (!v) return null;
  const iso = v.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const us = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (us) return `${us[3]}-${us[1]}-${us[2]}`;
  return null;
}
