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
} from "./ad-connector.types";
import { toFixed4, toInt, toMoney } from "./ad-report.util";
import type { TokenSet } from "../connector.types";

const API_BASE = "https://business-api.tiktok.com/open_api/v1.3";
const PAGE_SIZE = 1000;
/**
 * BASIC rapor metrikleri. `total_complete_payment_value` hesap optimizasyon
 * olayına bağlı; yoksa 0 ayrıştırılır (campaign-level conversionValue degrade olur,
 * blended ROAS store ciro'sundan beslenir).
 */
const METRICS = [
  "spend",
  "impressions",
  "clicks",
  "conversion",
  "total_complete_payment_value",
];

/** TikTok integrated report satırı. */
interface TikTokReportRow {
  dimensions?: { campaign_id?: string; stat_time_day?: string };
  metrics?: Record<string, string | number | undefined>;
}

/**
 * TikTok Ads connector — Business API OAuth + integrated report.
 * Canlı `fetchInsights` campaign-level (AUCTION_CAMPAIGN) günlük harcamayı çeker.
 * Erişim token'ı uzun ömürlü olduğundan refresh gerekmez. Ürün-seviyesi kapsam dışı.
 * Dev (`dev_` token) yolu sentetik veri kullanır.
 */
@Injectable()
export class TikTokAdsConnector implements AdConnector {
  readonly provider = "tiktok_ads" as const;
  private readonly logger = new Logger(TikTokAdsConnector.name);

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
    const res = await fetch(`${API_BASE}/oauth2/access_token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: this.config.getOrThrow<string>("TIKTOK_APP_ID"),
        secret: this.config.getOrThrow<string>("TIKTOK_APP_SECRET"),
        auth_code: code,
      }),
    });
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

  async fetchInsights({
    accessToken,
    externalAccountId,
    since,
    until,
  }: AdInsightsParams): Promise<AdInsightsResult> {
    const spend: AdSpendRow[] = [];
    const campaigns = new Map<string, AdEntityRow>();
    let page = 1;
    let totalPage = 1;

    while (page <= totalPage && page <= 50) {
      const url = new URL(`${API_BASE}/report/integrated/get/`);
      url.searchParams.set("advertiser_id", externalAccountId);
      url.searchParams.set("report_type", "BASIC");
      url.searchParams.set("data_level", "AUCTION_CAMPAIGN");
      url.searchParams.set(
        "dimensions",
        JSON.stringify(["campaign_id", "stat_time_day"]),
      );
      url.searchParams.set("metrics", JSON.stringify(METRICS));
      url.searchParams.set("start_date", since);
      url.searchParams.set("end_date", until);
      url.searchParams.set("page", String(page));
      url.searchParams.set("page_size", String(PAGE_SIZE));

      const res = await fetch(url, { headers: { "Access-Token": accessToken } });
      if (!res.ok) {
        throw new Error(`TikTok rapor başarısız (${res.status})`);
      }
      const body = (await res.json()) as {
        code?: number;
        message?: string;
        data?: {
          list?: TikTokReportRow[];
          page_info?: { total_page?: number };
        };
      };
      if (body.code !== 0) {
        throw new Error(`TikTok rapor hatası: ${body.message ?? body.code}`);
      }

      for (const row of body.data?.list ?? []) {
        const id = row.dimensions?.campaign_id;
        const day = row.dimensions?.stat_time_day;
        if (!id || !day) continue;
        const m = row.metrics ?? {};
        spend.push({
          date: day.slice(0, 10),
          level: "campaign",
          entityExternalId: id,
          campaignExternalId: id,
          name: null,
          spend: toMoney(m.spend),
          impressions: toInt(m.impressions),
          clicks: toInt(m.clicks),
          conversions: toFixed4(m.conversion),
          conversionValue: toFixed4(m.total_complete_payment_value),
          currency: null,
        });
        if (!campaigns.has(id)) {
          campaigns.set(id, {
            level: "campaign",
            externalId: id,
            name: null,
            parentExternalId: null,
            campaignExternalId: id,
            status: null,
            currency: null,
          });
        }
      }

      totalPage = body.data?.page_info?.total_page ?? 1;
      page += 1;
    }

    this.logger.log(
      `TikTok Ads ${externalAccountId} ${since}→${until}: ${spend.length} satır`,
    );
    return { entities: [...campaigns.values()], spend };
  }
}
