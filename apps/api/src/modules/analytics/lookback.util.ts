/**
 * Plan look-back uygulaması (sessiz clamp).
 * `from` tarihi (YYYY-MM-DD) planın izin verdiği pencereden (bugün − lookbackDays)
 * daha eskiyse, en eski izinli tarihe çekilir. Hata atılmaz — grafikler yalnız
 * izinli aralığı gösterir.
 */
export function clampFromToLookback(
  from: string,
  lookbackDays: number,
  today: Date = new Date(),
): string {
  const earliest = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  earliest.setUTCDate(earliest.getUTCDate() - lookbackDays);
  const earliestStr = earliest.toISOString().slice(0, 10);
  return from < earliestStr ? earliestStr : from;
}
