import { gzipSync } from "node:zlib";
import { ConfigService } from "@nestjs/config";
import { AmazonAdsConnector } from "./amazon-ads.connector";
import { EbayMarketingConnector } from "./ebay-marketing.connector";
import { GoogleAdsConnector } from "./google.connector";
import { MetaConnector } from "./meta.connector";
import { TikTokAdsConnector } from "./tiktok.connector";
import {
  generateSyntheticAds,
  generateSyntheticProductAds,
} from "./ads-synthetic";

// Async rapor poll'larındaki bekleme'yi anında çöz (testleri hızlandırır).
jest.mock("./ad-report.util", () => ({
  ...jest.requireActual("./ad-report.util"),
  sleep: jest.fn(() => Promise.resolve()),
}));

function configWith(values: Record<string, string>): ConfigService {
  return {
    get: (k: string) => values[k],
    getOrThrow: (k: string) => {
      const v = values[k];
      if (v == null) throw new Error(`missing ${k}`);
      return v;
    },
  } as unknown as ConfigService;
}

describe("ad connectors — buildAuthUrl", () => {
  it("Meta authorize URL doğru parametreleri içerir", () => {
    const c = new MetaConnector(configWith({ META_APP_ID: "app123" }));
    const url = new URL(
      c.buildAuthUrl({ state: "st", redirectUri: "https://x/cb" }),
    );
    expect(url.hostname).toBe("www.facebook.com");
    expect(url.searchParams.get("client_id")).toBe("app123");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("redirect_uri")).toBe("https://x/cb");
    expect(url.searchParams.get("scope")).toContain("ads_read");
  });

  it("Google authorize URL offline + adwords scope", () => {
    const c = new GoogleAdsConnector(configWith({ GOOGLE_ADS_CLIENT_ID: "gid" }));
    const url = new URL(
      c.buildAuthUrl({ state: "s2", redirectUri: "https://x/cb" }),
    );
    expect(url.hostname).toBe("accounts.google.com");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("scope")).toContain("adwords");
  });

  it("TikTok authorize URL app_id ile", () => {
    const c = new TikTokAdsConnector(configWith({ TIKTOK_APP_ID: "tk1" }));
    const url = new URL(
      c.buildAuthUrl({ state: "s3", redirectUri: "https://x/cb" }),
    );
    expect(url.hostname).toBe("business-api.tiktok.com");
    expect(url.searchParams.get("app_id")).toBe("tk1");
  });

  it("isConfigured kimlik yoksa false", () => {
    expect(new MetaConnector(configWith({})).isConfigured()).toBe(false);
    expect(
      new MetaConnector(
        configWith({ META_APP_ID: "a", META_APP_SECRET: "b" }),
      ).isConfigured(),
    ).toBe(true);
  });

  it("Amazon Ads authorize URL LWA + advertising scope", () => {
    const c = new AmazonAdsConnector(
      configWith({ AMAZON_ADS_CLIENT_ID: "amzn1" }),
    );
    const url = new URL(
      c.buildAuthUrl({ state: "s4", redirectUri: "https://x/cb" }),
    );
    expect(url.hostname).toBe("www.amazon.com");
    expect(url.searchParams.get("client_id")).toBe("amzn1");
    expect(url.searchParams.get("scope")).toContain("advertising");
    expect(c.provider).toBe("amazon_ads");
  });

  it("eBay Marketing authorize URL marketing scope", () => {
    const c = new EbayMarketingConnector(
      configWith({ EBAY_ADS_CLIENT_ID: "ebay1" }),
    );
    const url = new URL(
      c.buildAuthUrl({ state: "s5", redirectUri: "https://x/cb" }),
    );
    expect(url.hostname).toBe("auth.ebay.com");
    expect(url.searchParams.get("scope")).toContain("marketing");
    expect(c.provider).toBe("ebay_ads");
  });
});

describe("generateSyntheticAds", () => {
  it("deterministik: aynı hesap → aynı toplam harcama", () => {
    const a = generateSyntheticAds("act_demo");
    const b = generateSyntheticAds("act_demo");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("kampanya seviyesi toplamı = ad seviyesi toplamı (çift sayım yok)", () => {
    const { spend } = generateSyntheticAds("act_demo");
    const sumLevel = (level: string) =>
      spend
        .filter((r) => r.level === level)
        .reduce((acc, r) => acc + Number(r.spend), 0);
    const campaign = Math.round(sumLevel("campaign") * 1e4) / 1e4;
    const ad = Math.round(sumLevel("ad") * 1e4) / 1e4;
    const adset = Math.round(sumLevel("adset") * 1e4) / 1e4;
    expect(campaign).toBe(ad);
    expect(adset).toBe(ad);
    expect(campaign).toBeGreaterThan(0);
  });

  it("hiyerarşi: 2 kampanya + 4 adset + 8 ad varlığı", () => {
    const { entities } = generateSyntheticAds("act_demo");
    const byLevel = (l: string) => entities.filter((e) => e.level === l).length;
    expect(byLevel("campaign")).toBe(2);
    expect(byLevel("adset")).toBe(4);
    expect(byLevel("ad")).toBe(8);
  });
});

describe("generateSyntheticProductAds", () => {
  it("ürün yoksa boş dizi (blended fallback)", () => {
    expect(generateSyntheticProductAds("act_demo", [])).toEqual([]);
  });

  it("ürün-harcama toplamı = kampanya-harcama toplamı (atıf korunur)", () => {
    const ids = ["p1", "p2", "p3"];
    const product = generateSyntheticProductAds("act_demo", ids);
    const { spend } = generateSyntheticAds("act_demo");
    const sumProduct =
      Math.round(
        product.reduce((acc, r) => acc + Number(r.spend), 0) * 1e2,
      ) / 1e2;
    const sumCampaign =
      Math.round(
        spend
          .filter((r) => r.level === "campaign")
          .reduce((acc, r) => acc + Number(r.spend), 0) * 1e2,
      ) / 1e2;
    expect(sumProduct).toBe(sumCampaign);
  });

  it("deterministik + her ürün için satır üretir", () => {
    const a = generateSyntheticProductAds("act_x", ["p1", "p2"]);
    const b = generateSyntheticProductAds("act_x", ["p1", "p2"]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(new Set(a.map((r) => r.productExternalId))).toEqual(
      new Set(["p1", "p2"]),
    );
  });
});

// ---- Canlı fetchInsights / refresh / hesap çözümleme (mock fetch) ----

interface FakeResponse {
  ok?: boolean;
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
  text?: string;
  gzip?: unknown;
}

function fakeResponse(r: FakeResponse): unknown {
  const headers = r.headers ?? {};
  return {
    ok: r.ok ?? true,
    status: r.status ?? 200,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => r.body ?? {},
    text: async () => r.text ?? "",
    arrayBuffer: async () => {
      const gz = gzipSync(Buffer.from(JSON.stringify(r.gzip ?? [])));
      return gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength);
    },
  };
}

describe("ad connectors — canlı fetchInsights", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  function seqFetch(...responses: FakeResponse[]): jest.Mock {
    const fn = jest.fn();
    for (const r of responses) fn.mockResolvedValueOnce(fakeResponse(r));
    global.fetch = fn as unknown as typeof fetch;
    return fn;
  }

  it("Google: campaign + shopping ürün harcamasını ayrıştırır", async () => {
    seqFetch(
      {
        body: [
          {
            results: [
              {
                campaign: { id: "c1", name: "Camp 1", status: "ENABLED" },
                segments: { date: "2024-06-01" },
                metrics: {
                  costMicros: "5000000",
                  impressions: "1000",
                  clicks: "50",
                  conversions: 4,
                  conversionsValue: 200,
                },
              },
            ],
          },
        ],
      },
      {
        body: [
          {
            results: [
              {
                segments: { productItemId: "ASIN123", date: "2024-06-01" },
                metrics: {
                  costMicros: "2000000",
                  clicks: "10",
                  conversions: 1,
                  conversionsValue: 50,
                },
              },
            ],
          },
        ],
      },
    );
    const c = new GoogleAdsConnector(
      configWith({
        GOOGLE_ADS_CLIENT_ID: "gid",
        GOOGLE_ADS_CLIENT_SECRET: "sec",
        GOOGLE_ADS_DEVELOPER_TOKEN: "dev",
      }),
    );
    const res = await c.fetchInsights({
      accessToken: "tok",
      externalAccountId: "123-456-7890",
      since: "2024-06-01",
      until: "2024-06-02",
    });
    expect(res.spend).toHaveLength(1);
    expect(res.spend[0].spend).toBe("5.0000");
    expect(res.entities).toHaveLength(1);
    expect(res.productSpend?.[0]).toMatchObject({
      productExternalId: "ASIN123",
      spend: "2.0000",
    });
  });

  it("Google: refreshToken yeni access token döndürür, refresh token'ı korur", async () => {
    seqFetch({ body: { access_token: "new-tok", expires_in: 3600 } });
    const c = new GoogleAdsConnector(
      configWith({ GOOGLE_ADS_CLIENT_ID: "gid", GOOGLE_ADS_CLIENT_SECRET: "sec" }),
    );
    const tokens = await c.refreshToken("refresh-1");
    expect(tokens.accessToken).toBe("new-tok");
    expect(tokens.refreshToken).toBe("refresh-1");
    expect(tokens.expiresAt).toBeInstanceOf(Date);
  });

  it("Google: exchangeCode hesap kimliğini (customerId) çözer", async () => {
    seqFetch(
      { body: { access_token: "tok", refresh_token: "r", expires_in: 3600 } },
      { body: { resourceNames: ["customers/9998887776"] } },
    );
    const c = new GoogleAdsConnector(
      configWith({
        GOOGLE_ADS_CLIENT_ID: "gid",
        GOOGLE_ADS_CLIENT_SECRET: "sec",
        GOOGLE_ADS_DEVELOPER_TOKEN: "dev",
      }),
    );
    const tokens = await c.exchangeCode({
      code: "abc",
      redirectUri: "https://x/cb",
    });
    expect(tokens.externalAccountId).toBe("9998887776");
  });

  it("TikTok: integrated report'u campaign satırına çevirir", async () => {
    seqFetch({
      body: {
        code: 0,
        message: "OK",
        data: {
          list: [
            {
              dimensions: { campaign_id: "c1", stat_time_day: "2024-06-01 00:00:00" },
              metrics: {
                spend: "12.5",
                impressions: "1000",
                clicks: "30",
                conversion: "2",
                total_complete_payment_value: "60",
              },
            },
          ],
          page_info: { total_page: 1 },
        },
      },
    });
    const c = new TikTokAdsConnector(
      configWith({ TIKTOK_APP_ID: "tk", TIKTOK_APP_SECRET: "s" }),
    );
    const res = await c.fetchInsights({
      accessToken: "tok",
      externalAccountId: "adv1",
      since: "2024-06-01",
      until: "2024-06-02",
    });
    expect(res.spend).toHaveLength(1);
    expect(res.spend[0]).toMatchObject({
      date: "2024-06-01",
      entityExternalId: "c1",
      spend: "12.5000",
      conversionValue: "60.0000",
    });
  });

  it("Amazon: async campaign + ASIN ürün raporunu çeker (gzip)", async () => {
    seqFetch(
      { body: { reportId: "r1" } },
      { body: { status: "COMPLETED", url: "https://dl/1" } },
      {
        gzip: [
          {
            date: "2024-06-01",
            campaignId: "c1",
            campaignName: "Camp",
            cost: 5,
            impressions: 1000,
            clicks: 50,
            purchases7d: 4,
            sales7d: 200,
          },
        ],
      },
      { body: { reportId: "r2" } },
      { body: { status: "COMPLETED", url: "https://dl/2" } },
      {
        gzip: [
          {
            date: "2024-06-01",
            advertisedAsin: "ASIN1",
            cost: 2,
            clicks: 10,
            purchases7d: 1,
            sales7d: 50,
          },
        ],
      },
    );
    const c = new AmazonAdsConnector(
      configWith({ AMAZON_ADS_CLIENT_ID: "amzn", AMAZON_ADS_CLIENT_SECRET: "s" }),
    );
    const res = await c.fetchInsights({
      accessToken: "tok",
      externalAccountId: "profile-1",
      since: "2024-06-01",
      until: "2024-06-02",
      metadata: { region: "NA" },
    });
    expect(res.spend[0]).toMatchObject({
      entityExternalId: "c1",
      spend: "5.0000",
      conversionValue: "200.0000",
    });
    expect(res.productSpend?.[0]).toMatchObject({
      productExternalId: "ASIN1",
      spend: "2.0000",
    });
  });

  it("eBay: async campaign + listing raporunu (TSV) çeker", async () => {
    const campaignTsv =
      "campaign_id\tcampaign_name\tday\tclicks\timpressions\tad_fees\tsale_amount\tsales\n" +
      "c1\tCamp 1\t2024-06-01\t30\t1000\t5.00\t200.00\t4";
    const listingTsv =
      "listing_id\tday\tclicks\timpressions\tad_fees\tsale_amount\tsales\n" +
      "L123\t2024-06-01\t10\t500\t2.00\t50.00\t1";
    seqFetch(
      { status: 202, headers: { location: "/sell/marketing/v1/ad_report_task/t1" } },
      { body: { status: "COMPLETED", reportHref: "https://dl/c" } },
      { text: campaignTsv },
      { status: 202, headers: { location: "/sell/marketing/v1/ad_report_task/t2" } },
      { body: { status: "COMPLETED", reportHref: "https://dl/l" } },
      { text: listingTsv },
    );
    const c = new EbayMarketingConnector(
      configWith({ EBAY_ADS_CLIENT_ID: "eb", EBAY_ADS_CLIENT_SECRET: "s" }),
    );
    const res = await c.fetchInsights({
      accessToken: "tok",
      externalAccountId: "seller-1",
      since: "2024-06-01",
      until: "2024-06-02",
    });
    expect(res.spend[0]).toMatchObject({
      entityExternalId: "c1",
      date: "2024-06-01",
      spend: "5.0000",
      conversionValue: "200.0000",
    });
    expect(res.productSpend?.[0]).toMatchObject({
      productExternalId: "L123",
      spend: "2.0000",
    });
  });
});
