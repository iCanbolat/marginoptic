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
