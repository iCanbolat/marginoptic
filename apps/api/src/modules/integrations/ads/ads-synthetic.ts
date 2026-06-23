import type {
  AdEntityRow,
  AdInsightsResult,
  AdSpendRow,
} from "./ad-connector.types";

/**
 * Dev reklam bağlantıları için gerçek sağlayıcı olmadan deterministik insight üretir.
 * Sentetik sipariş penceresiyle (bugünden geriye ~6 ay) örtüşür ki blended ROAS/POAS
 * anlamlı olsun ve dashboard varsayılan aralığı reklam harcaması göstersin.
 * Hiyerarşi: 2 kampanya × 2 adset × 2 ad = 8 ad; adset/kampanya satırları ad'lardan toplanır.
 */

const WINDOW_DAYS = 180;
const AD_COUNT = 8; // adset = floor(a/2), campaign = floor(a/4)

/** Pencere başlangıcı: bugünden (WINDOW_DAYS - 1) gün öncesi (UTC). */
function windowStart(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (WINDOW_DAYS - 1));
  return d.toISOString().slice(0, 10);
}

/** Hesap kimliğinden deterministik sayısal taban. */
function seed(account: string): number {
  let h = 0;
  for (const ch of account) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return h;
}

function dayIso(start: string, offset: number): string {
  const base = Date.parse(`${start}T00:00:00.000Z`);
  return new Date(base + offset * 86_400_000).toISOString().slice(0, 10);
}

const r4 = (n: number): string => (Math.round(n * 1e4) / 1e4).toFixed(4);

/** Bir reklamın bir gündeki ham harcaması (deterministik). */
function adSpendValue(a: number, di: number): number {
  return 5 + a + (di % 7) * 0.5;
}

interface Leaf {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
}

function leaf(a: number, di: number): Leaf {
  const spend = adSpendValue(a, di);
  return {
    spend,
    impressions: Math.round(spend * 120),
    clicks: Math.round(spend * 3),
    conversions: Math.round(spend * 0.04 * 1e4) / 1e4,
    conversionValue: Math.round(spend * 3.5 * 1e4) / 1e4,
  };
}

export function generateSyntheticAds(account: string): AdInsightsResult {
  const s = seed(account);
  const start = windowStart();
  const cmpId = (c: number) => `c_${s}_${c}`;
  const astId = (a: number) => `as_${s}_${a}`;
  const adId = (a: number) => `ad_${s}_${a}`;

  // ---- entities ----
  const entities: AdEntityRow[] = [];
  for (let c = 0; c < 2; c++) {
    entities.push({
      level: "campaign",
      externalId: cmpId(c),
      name: `Demo Kampanya ${c + 1}`,
      parentExternalId: null,
      campaignExternalId: cmpId(c),
      status: "active",
      currency: "USD",
    });
  }
  for (let as = 0; as < 4; as++) {
    const c = Math.floor(as / 2);
    entities.push({
      level: "adset",
      externalId: astId(as),
      name: `Demo Adset ${as + 1}`,
      parentExternalId: cmpId(c),
      campaignExternalId: cmpId(c),
      status: "active",
      currency: "USD",
    });
  }
  for (let a = 0; a < AD_COUNT; a++) {
    const as = Math.floor(a / 2);
    const c = Math.floor(a / 4);
    entities.push({
      level: "ad",
      externalId: adId(a),
      name: `Demo Reklam ${a + 1}`,
      parentExternalId: astId(as),
      campaignExternalId: cmpId(c),
      status: "active",
      currency: "USD",
    });
  }

  // ---- spend (gün başına; ad satırları + toplanmış adset/campaign) ----
  const spend: AdSpendRow[] = [];
  for (let di = 0; di < WINDOW_DAYS; di++) {
    const date = dayIso(start, di);
    const byAdset = new Map<number, Leaf>();
    const byCampaign = new Map<number, Leaf>();
    const add = (m: Map<number, Leaf>, k: number, l: Leaf) => {
      const cur = m.get(k) ?? {
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        conversionValue: 0,
      };
      m.set(k, {
        spend: cur.spend + l.spend,
        impressions: cur.impressions + l.impressions,
        clicks: cur.clicks + l.clicks,
        conversions: cur.conversions + l.conversions,
        conversionValue: cur.conversionValue + l.conversionValue,
      });
    };

    for (let a = 0; a < AD_COUNT; a++) {
      const as = Math.floor(a / 2);
      const c = Math.floor(a / 4);
      const l = leaf(a, di);
      add(byAdset, as, l);
      add(byCampaign, c, l);
      spend.push(row(date, "ad", adId(a), cmpId(c), `Demo Reklam ${a + 1}`, l));
    }
    for (const [as, l] of byAdset) {
      const c = Math.floor(as / 2);
      spend.push(row(date, "adset", astId(as), cmpId(c), `Demo Adset ${as + 1}`, l));
    }
    for (const [c, l] of byCampaign) {
      spend.push(row(date, "campaign", cmpId(c), cmpId(c), `Demo Kampanya ${c + 1}`, l));
    }
  }

  return { entities, spend };
}

function row(
  date: string,
  level: AdSpendRow["level"],
  entityExternalId: string,
  campaignExternalId: string,
  name: string,
  l: Leaf,
): AdSpendRow {
  return {
    date,
    level,
    entityExternalId,
    campaignExternalId,
    name,
    spend: r4(l.spend),
    impressions: l.impressions,
    clicks: l.clicks,
    conversions: r4(l.conversions),
    conversionValue: r4(l.conversionValue),
    currency: "USD",
  };
}
