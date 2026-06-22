/**
 * Web biçimlendirme giriş noktası — `@churnify/shared`'in para/yüzde/sayı/tarih
 * yardımcılarını yeniden ihraç eder (tek kaynak) + null-güvenli sarmalayıcılar.
 * Varsayılan yerel `tr-TR`'dir; çoklu para birimi `currency` argümanıyla.
 */
export {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatDate,
  formatDateRange,
  formatRelativeTime,
  percentChange,
  toNumber,
  DEFAULT_LOCALE,
} from "@churnify/shared";

import { formatCurrency, formatNumber } from "@churnify/shared";

/** Para string'i (DB numeric) → biçimli; null/boş → tire. */
export function money(
  value: string | number | null | undefined,
  currency: string | null | undefined,
  opts?: { compact?: boolean },
): string {
  if (value == null || value === "") return "—";
  return formatCurrency(value, currency ?? "USD", opts);
}

/** Sayı → biçimli; null → tire. */
export function count(
  value: string | number | null | undefined,
  opts?: { compact?: boolean },
): string {
  if (value == null || value === "") return "—";
  return formatNumber(value, opts);
}
