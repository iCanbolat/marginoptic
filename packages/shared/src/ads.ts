import { z } from "zod";

/**
 * Faz 6 — Reklam entegrasyonları DTO sözleşmesi (API ⇄ web ortak).
 * Para alanları DB'de `numeric` olduğundan yanıtta ondalık string döner.
 */

export const AD_PROVIDERS = ["meta_ads", "google_ads", "tiktok_ads"] as const;
export type AdProvider = (typeof AD_PROVIDERS)[number];

export const AD_LEVELS = ["account", "campaign", "adset", "ad"] as const;
export type AdLevel = (typeof AD_LEVELS)[number];

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-MM-DD biçiminde olmalı");

export const adProviderSchema = z.enum(AD_PROVIDERS);

/** Reklam hesabı bağlama (dev-connect): mağaza + hesap kimliği. */
export const adConnectSchema = z.object({
  storeId: z.string().uuid(),
  externalAccountId: z.string().trim().min(1).max(255),
});
export type AdConnectInput = z.infer<typeof adConnectSchema>;

/** Reklam OAuth başlatma: harcamanın atfedileceği mağaza. */
export const adInstallSchema = z.object({
  storeId: z.string().uuid(),
});
export type AdInstallInput = z.infer<typeof adInstallSchema>;

/** Reklam performans sorgusu (tarih aralığı + kırılım seviyesi). */
export const adsPerformanceQuerySchema = z
  .object({
    from: isoDate,
    to: isoDate,
    level: z.enum(AD_LEVELS).default("campaign"),
  })
  .refine((v) => v.to >= v.from, {
    message: "to, from'dan önce olamaz",
    path: ["to"],
  });
export type AdsPerformanceQuery = z.infer<typeof adsPerformanceQuerySchema>;

/** Bir reklam varlığının aralık-toplam performansı (kırılım satırı). */
export interface AdPerformanceRow {
  provider: AdProvider;
  level: AdLevel;
  entityExternalId: string;
  campaignExternalId: string | null;
  name: string | null;
  spend: string;
  impressions: number;
  clicks: number;
  conversions: string;
  conversionValue: string;
  currency: string;
  /** conversionValue / spend; spend 0 ise null. */
  roas: number | null;
}

/** Gün-bazlı reklam serisi (grafik için). */
export interface AdDailyPoint {
  date: string;
  spend: string;
  conversionValue: string;
}

/** Mağaza-geneli reklam özeti + blended ROAS/POAS (daily_store_metrics ile). */
export interface AdsSummary {
  spend: string;
  impressions: number;
  clicks: number;
  conversions: string;
  conversionValue: string;
  /** Platform raporlu ROAS: conversionValue / spend. */
  roas: number | null;
  /** Mağaza cirosu (aralık) — blended ROAS için. */
  revenue: string;
  /** Mağaza net kârı (aralık) — POAS için. */
  netProfit: string;
  /** Blended ROAS: revenue / spend. */
  blendedRoas: number | null;
  /** POAS: net kâr / reklam harcaması. */
  poas: number | null;
}

export interface AdsPerformanceResponse {
  storeId: string;
  from: string;
  to: string;
  level: AdLevel;
  currency: string;
  summary: AdsSummary;
  rows: AdPerformanceRow[];
  daily: AdDailyPoint[];
}
