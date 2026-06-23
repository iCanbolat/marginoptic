import type {
  AdDailyPoint,
  AdLevel,
  AdPerformanceRow,
  AdsParams,
  AdsPerformanceResponse,
  AdsSummary,
  StoreSummary,
} from "../types/ad-types";

/**
 * Mock veri anahtarı. Orders feature'ı ile aynı `.env` bayrağını paylaşır:
 * `VITE_MOCK_ORDERS=true` yazıp dev server'ı yeniden başlatınca reklam feature'ı
 * API yerine bu sahte veriyi kullanır — backend/bağlı reklam hesabı olmadan
 * grafik/tablo/kırılım akışını test etmek için.
 */
export const USE_MOCK_ADS = import.meta.env.VITE_MOCK_ORDERS === "true";

const CURRENCY = "USD";

export const MOCK_STORES: StoreSummary[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    channel: "shopify",
    name: "Mock Mağaza",
    externalShopId: "mock-shop",
    domain: "mock.myshopify.com",
    currency: CURRENCY,
    status: "active",
  },
];

const num = (n: number): string => n.toFixed(2);
const safeRatio = (a: number, b: number): number | null =>
  b > 0 ? Math.round((a / b) * 100) / 100 : null;

/** Belirli bir kırılım seviyesi için deterministik sahte satırlar. */
function mockRows(level: AdLevel): AdPerformanceRow[] {
  if (level === "account") return [];
  const count = level === "campaign" ? 4 : level === "adset" ? 8 : 12;
  return Array.from({ length: count }, (_, i) => {
    const spend = 120 + ((i * 73) % 880);
    const conversionValue = spend * (1.4 + ((i * 7) % 30) / 10);
    const impressions = 4000 + ((i * 911) % 26000);
    const clicks = 80 + ((i * 53) % 540);
    const conversions = 3 + ((i * 3) % 22);
    return {
      provider: "meta_ads",
      level,
      entityExternalId: `${level}-${1000 + i}`,
      campaignExternalId: level === "campaign" ? null : `campaign-${1000 + (i % 4)}`,
      name: `${LEVEL_NAME[level]} ${i + 1}`,
      spend: num(spend),
      impressions,
      clicks,
      conversions: num(conversions),
      conversionValue: num(conversionValue),
      currency: CURRENCY,
      roas: safeRatio(conversionValue, spend),
    };
  });
}

const LEVEL_NAME: Record<AdLevel, string> = {
  account: "Hesap",
  campaign: "Kampanya",
  adset: "Adset",
  ad: "Reklam",
};

/** Aralık içindeki günleri (dahil) ISO tarih listesi olarak döndürür (max 120 gün). */
function daysBetween(from: string, to: string): string[] {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const out: string[] = [];
  for (
    let d = new Date(start);
    d <= end && out.length < 120;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function mockDaily(from: string, to: string): AdDailyPoint[] {
  return daysBetween(from, to).map((date, i) => {
    const spend = 60 + ((i * 41) % 240) + (i % 7 === 0 ? 90 : 0);
    const conversionValue = spend * (1.6 + ((i * 5) % 20) / 10);
    return {
      date,
      spend: num(spend),
      conversionValue: num(conversionValue),
    };
  });
}

function summarize(
  rows: AdPerformanceRow[],
  daily: AdDailyPoint[],
): AdsSummary {
  const spend = daily.reduce((s, d) => s + Number(d.spend), 0);
  const conversionValue = daily.reduce((s, d) => s + Number(d.conversionValue), 0);
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const conversions = rows.reduce((s, r) => s + Number(r.conversions), 0);
  const revenue = conversionValue * 1.35; // blended ciro reklam dışı satışları da kapsar
  const netProfit = revenue * 0.32;
  return {
    spend: num(spend),
    impressions,
    clicks,
    conversions: num(conversions),
    conversionValue: num(conversionValue),
    roas: safeRatio(conversionValue, spend),
    revenue: num(revenue),
    netProfit: num(netProfit),
    blendedRoas: safeRatio(revenue, spend),
    poas: safeRatio(netProfit, spend),
  };
}

/** API ile aynı sözleşmeyi taklit eder: özet + kırılım + günlük seri. */
export function mockAdsPerformance(
  storeId: string,
  params: AdsParams,
): AdsPerformanceResponse {
  const level = params.level ?? "campaign";
  const rows = mockRows(level);
  const daily = mockDaily(params.from, params.to);
  return {
    storeId,
    from: params.from,
    to: params.to,
    level,
    currency: CURRENCY,
    summary: summarize(rows, daily),
    rows,
    daily,
  };
}
