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
import type { TokenSet } from "../connector.types";

const GRAPH_VERSION = "v19.0";
const PURCHASE_ACTIONS = new Set([
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
]);

interface MetaInsightRow {
  date_start: string;
  campaign_id: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
  account_currency?: string;
}

/**
 * Meta (Facebook/Instagram) Ads connector — OAuth + Marketing API insights.
 * Canlı `fetchInsights` `act_{id}/insights` (level=campaign, time_increment=1) ile
 * günlük kampanya harcamasını çeker. Dev (`dev_` token) yolu sentetik veri kullanır.
 */
@Injectable()
export class MetaConnector implements AdConnector {
  readonly provider = "meta_ads" as const;
  private readonly logger = new Logger(MetaConnector.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return (
      !!this.config.get<string>("META_APP_ID") &&
      !!this.config.get<string>("META_APP_SECRET")
    );
  }

  buildAuthUrl({ state, redirectUri }: AdAuthUrlParams): string {
    const url = new URL(
      `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`,
    );
    url.searchParams.set("client_id", this.config.getOrThrow<string>("META_APP_ID"));
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "ads_read,read_insights");
    return url.toString();
  }

  async exchangeCode({ code, redirectUri }: AdExchangeParams): Promise<TokenSet> {
    const url = new URL(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
    );
    url.searchParams.set("client_id", this.config.getOrThrow<string>("META_APP_ID"));
    url.searchParams.set(
      "client_secret",
      this.config.getOrThrow<string>("META_APP_SECRET"),
    );
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("code", code);

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`Meta token değişimi başarısız (${res.status})`);
    }
    const data = (await res.json()) as {
      access_token: string;
      expires_in?: number;
    };
    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null,
      scopes: "ads_read,read_insights",
    };
  }

  async fetchInsights({
    accessToken,
    externalAccountId,
    since,
    until,
  }: AdInsightsParams): Promise<AdInsightsResult> {
    const account = externalAccountId.startsWith("act_")
      ? externalAccountId
      : `act_${externalAccountId}`;
    const url = new URL(
      `https://graph.facebook.com/${GRAPH_VERSION}/${account}/insights`,
    );
    url.searchParams.set("level", "campaign");
    url.searchParams.set("time_increment", "1");
    url.searchParams.set(
      "fields",
      "campaign_id,campaign_name,spend,impressions,clicks,actions,action_values,account_currency",
    );
    url.searchParams.set("time_range", JSON.stringify({ since, until }));
    url.searchParams.set("limit", "500");
    url.searchParams.set("access_token", accessToken);

    const spend: AdSpendRow[] = [];
    const campaigns = new Map<string, AdEntityRow>();
    let next: string | null = url.toString();
    let pages = 0;

    while (next && pages < 50) {
      const res: Response = await fetch(next);
      if (!res.ok) {
        throw new Error(`Meta insights başarısız (${res.status})`);
      }
      const body = (await res.json()) as {
        data?: MetaInsightRow[];
        paging?: { next?: string };
      };
      for (const row of body.data ?? []) {
        const currency = row.account_currency ?? null;
        const conversions = sumActions(row.actions);
        const conversionValue = sumActions(row.action_values);
        spend.push({
          date: row.date_start,
          level: "campaign",
          entityExternalId: row.campaign_id,
          campaignExternalId: row.campaign_id,
          name: row.campaign_name ?? null,
          spend: toMoney(row.spend),
          impressions: toInt(row.impressions),
          clicks: toInt(row.clicks),
          conversions: conversions.toFixed(4),
          conversionValue: conversionValue.toFixed(4),
          currency,
        });
        if (!campaigns.has(row.campaign_id)) {
          campaigns.set(row.campaign_id, {
            level: "campaign",
            externalId: row.campaign_id,
            name: row.campaign_name ?? null,
            parentExternalId: null,
            campaignExternalId: row.campaign_id,
            status: null,
            currency,
          });
        }
      }
      next = body.paging?.next ?? null;
      pages += 1;
    }

    this.logger.log(
      `Meta insights ${account} ${since}→${until}: ${spend.length} satır`,
    );
    return { entities: [...campaigns.values()], spend };
  }
}

function sumActions(
  rows: { action_type: string; value: string }[] | undefined,
): number {
  if (!rows) return 0;
  return rows
    .filter((r) => PURCHASE_ACTIONS.has(r.action_type))
    .reduce((acc, r) => acc + (Number(r.value) || 0), 0);
}

function toMoney(v: string | undefined): string {
  const n = Number(v ?? 0);
  return (Number.isFinite(n) ? n : 0).toFixed(4);
}

function toInt(v: string | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}
