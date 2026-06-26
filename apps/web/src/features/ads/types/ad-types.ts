// Shared reklam sözleşmelerini feature içi tek import noktası olarak yeniden ihraç et.
export {
  AD_LEVELS,
} from "@churnify/shared";
export type {
  AdLevel,
  AdProvider,
  AdsSummary,
  AdPerformanceRow,
  AdDailyPoint,
  AdsPerformanceResponse,
  ChannelSummary,
} from "@churnify/shared";

import type { AdLevel } from "@churnify/shared";

/** Reklam performansı sorgu parametreleri (axios `params` olarak gönderilir). */
export interface AdsParams {
  from: string;
  to: string;
  level?: AdLevel;
}

/** Kırılım seviyesi etiketleri (tek kaynak). */
export const LEVEL_LABEL: Record<AdLevel, string> = {
  account: "Hesap",
  campaign: "Kampanya",
  adset: "Adset",
  ad: "Reklam",
};

/** Varsayılan kırılım seviyesi. */
export const DEFAULT_LEVEL: AdLevel = "campaign";
