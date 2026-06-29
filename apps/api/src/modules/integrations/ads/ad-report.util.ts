/**
 * Reklam connector'ları (Google/TikTok/Amazon/eBay) için ortak normalize
 * yardımcıları. Para alanları DB `numeric` olduğundan 4 ondalıklı string döner.
 * Bu modül `@churnify/shared`'dan değer import etmez (jest güvenli).
 */

/** Sayısal değer → 4 ondalıklı para string (geçersiz → "0.0000"). */
export function toMoney(v: string | number | undefined | null): string {
  const n = Number(v ?? 0);
  return (Number.isFinite(n) ? n : 0).toFixed(4);
}

/** Micros (1e6 birim, Google Ads) → para string. */
export function microsToMoney(v: string | number | undefined | null): string {
  const n = Number(v ?? 0);
  return (Number.isFinite(n) ? n / 1e6 : 0).toFixed(4);
}

/** Sayısal değer → tam sayı (trunc). */
export function toInt(v: string | number | undefined | null): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/** Sayısal değer → 4 ondalıklı string (conversions/conversionValue). */
export function toFixed4(v: string | number | undefined | null): string {
  const n = Number(v ?? 0);
  return (Number.isFinite(n) ? n : 0).toFixed(4);
}

/** Promise tabanlı bekleme (asenkron rapor polling için). */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
