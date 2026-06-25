import type { AdLevel, AdProvider } from "@churnify/shared";
import type { TokenSet } from "../connector.types";

export interface AdAuthUrlParams {
  state: string;
  redirectUri: string;
}

export interface AdExchangeParams {
  code: string;
  redirectUri: string;
}

/** Reklam insight'ı çekme parametreleri (gün aralığı). */
export interface AdInsightsParams {
  accessToken: string;
  externalAccountId: string;
  since: string; // YYYY-MM-DD
  until: string; // YYYY-MM-DD
}

/** Normalize edilmiş reklam varlığı (hiyerarşi düğümü). */
export interface AdEntityRow {
  level: AdLevel;
  externalId: string;
  name: string | null;
  parentExternalId: string | null;
  campaignExternalId: string | null;
  status: string | null;
  currency: string | null;
}

/** Normalize edilmiş gün-bazlı harcama/metrik satırı. */
export interface AdSpendRow {
  date: string; // YYYY-MM-DD
  level: AdLevel;
  entityExternalId: string;
  campaignExternalId: string | null;
  name: string | null;
  spend: string;
  impressions: number;
  clicks: number;
  conversions: string;
  conversionValue: string;
  currency: string | null;
}

/**
 * Ürün-seviyesi gün-bazlı harcama satırı. Amazon Ads (ASIN/SellerSKU), eBay
 * Promoted Listings (listing id) ve Meta/Google katalog raporları doğrudan ürün
 * kırılımı verir; `productExternalId` ürünün satış-kanalı dış kimliğiyle eşleşir
 * (product_profit_daily ile join için).
 */
export interface ProductAdSpendRow {
  date: string; // YYYY-MM-DD
  productExternalId: string;
  spend: string;
  clicks: number;
  conversions: string;
  conversionValue: string;
}

export interface AdInsightsResult {
  entities: AdEntityRow[];
  spend: AdSpendRow[];
  /** Ürün-seviyesi harcama (yalnız ürünü raporlayan sağlayıcılarda). */
  productSpend?: ProductAdSpendRow[];
}

/** Tüm reklam sağlayıcılarının (Meta/Google/TikTok) OAuth + insight sözleşmesi. */
export interface AdConnector {
  readonly provider: AdProvider;
  buildAuthUrl(params: AdAuthUrlParams): string;
  exchangeCode(params: AdExchangeParams): Promise<TokenSet>;
  refreshToken?(refreshToken: string): Promise<TokenSet>;
  /** Canlı hesaptan gün-bazlı insight çeker (dev `dev_` token'da çağrılmaz). */
  fetchInsights(params: AdInsightsParams): Promise<AdInsightsResult>;
  /** Sağlayıcı kimlik bilgileri (app id/secret) yapılandırılmış mı? */
  isConfigured(): boolean;
}

/** DI token'ı: kayıtlı reklam connector'ları. */
export const AD_CONNECTORS = Symbol("AD_CONNECTORS");
