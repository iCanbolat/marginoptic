/**
 * Sunum katmanı biçimlendiricileri (API ⇄ web ortak).
 *
 * Parasal değerler API'de `numeric` olduğundan ana birim (major unit) cinsinden
 * ondalık **string** döner (ör. "39.0000"). Bu yardımcılar number | string kabul
 * eder; minor-unit (cent) taşıyan {@link Money} için `money.ts` ayrıdır.
 *
 * Faz 7 panosu ve grafik/eksen etiketleri bu biçimlendiricileri kullanır.
 */

export const DEFAULT_LOCALE = "tr-TR";

/** number | string | null → finite number (geçersizse 0). */
export function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

export interface FormatCurrencyOptions {
  locale?: string;
  /** Ondalık basamak sayısı (varsayılan: 2; tam sayıysa 0'a düşürmek için `compact` kullan). */
  fractionDigits?: number;
  /** Büyük sayıları kısalt (1.2K, 3.4M). */
  compact?: boolean;
}

/**
 * Ana-birim parasal değeri yerele göre para birimiyle biçimlendirir.
 * Çoklu para birimi: `currency` ISO-4217 (USD/EUR/TRY…).
 */
export function formatCurrency(
  value: number | string | null | undefined,
  currency: string,
  opts: FormatCurrencyOptions = {},
): string {
  const { locale = DEFAULT_LOCALE, fractionDigits = 2, compact = false } = opts;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    minimumFractionDigits: compact ? undefined : fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(toNumber(value));
}

export interface FormatNumberOptions {
  locale?: string;
  fractionDigits?: number;
  compact?: boolean;
}

/** Düz sayı biçimlendirme (adet, sipariş sayısı vb.). */
export function formatNumber(
  value: number | string | null | undefined,
  opts: FormatNumberOptions = {},
): string {
  const { locale = DEFAULT_LOCALE, fractionDigits, compact = false } = opts;
  return new Intl.NumberFormat(locale, {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: fractionDigits ?? (compact ? 1 : 2),
    minimumFractionDigits: 0,
  }).format(toNumber(value));
}

export interface FormatPercentOptions {
  locale?: string;
  fractionDigits?: number;
  /** Girdi zaten 0..1 oranı mı (true) yoksa 0..100 yüzde değeri mi (false, varsayılan)? */
  ratio?: boolean;
  /** Pozitif değerlere `+` öneki ekle (değişim göstergeleri için). */
  signed?: boolean;
}

/** Yüzde biçimlendirme. Varsayılan girdi 0..100 (ör. 12.5 → "%12,5"). */
export function formatPercent(
  value: number | string | null | undefined,
  opts: FormatPercentOptions = {},
): string {
  const { locale = DEFAULT_LOCALE, fractionDigits = 1, ratio = false, signed = false } = opts;
  const n = toNumber(value) / (ratio ? 1 : 100);
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(n);
}

/** İki dönem arası yüzde değişim (0..100 ölçeğinde); önceki 0 ise null. */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

export interface FormatDateOptions {
  locale?: string;
  style?: "short" | "medium" | "long";
}

/** Tarih biçimlendirme (ISO string | Date | epoch ms kabul eder). */
export function formatDate(
  value: Date | string | number,
  opts: FormatDateOptions = {},
): string {
  const { locale = DEFAULT_LOCALE, style = "medium" } = opts;
  const presets: Record<string, Intl.DateTimeFormatOptions> = {
    short: { day: "2-digit", month: "2-digit" },
    medium: { day: "2-digit", month: "short", year: "numeric" },
    long: { day: "numeric", month: "long", year: "numeric" },
  };
  return new Intl.DateTimeFormat(locale, presets[style]).format(toDate(value));
}

/** "from – to" aralığı (aynı gün ise tek tarih). */
export function formatDateRange(
  from: Date | string | number,
  to: Date | string | number,
  opts: FormatDateOptions = {},
): string {
  const a = formatDate(from, opts);
  const b = formatDate(to, opts);
  return a === b ? a : `${a} – ${b}`;
}

/** "5 dk önce" / "2 sa önce" benzeri göreli zaman (tazelik rozetleri için). */
export function formatRelativeTime(
  value: Date | string | number,
  opts: { locale?: string; now?: Date } = {},
): string {
  const { locale = DEFAULT_LOCALE, now = new Date() } = opts;
  const diffMs = toDate(value).getTime() - now.getTime();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diffMs);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
    ["second", 1000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === "second") {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return rtf.format(0, "second");
}
