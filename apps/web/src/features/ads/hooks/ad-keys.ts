import type { AdsParams } from "../types/ad-types";

/** Ads feature'ı için query key fabrikası. */
export const adKeys = {
  all: ["ads-performance"] as const,
  performance: (storeId: string | null, params: AdsParams) =>
    [...adKeys.all, storeId, params] as const,
  // Mağaza listesi birden çok feature tarafından kullanılır; ortak anahtar.
  stores: () => ["stores"] as const,
};
