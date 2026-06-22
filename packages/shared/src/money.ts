/**
 * Para birimi yardımcıları. Tüm parasal değerler dahili olarak minor unit (kuruş/cent)
 * cinsinden tamsayı olarak taşınır; sunum katmanında biçimlendirilir.
 */

export type CurrencyCode = string; // ISO 4217, ör. "USD", "TRY", "EUR"

export interface Money {
  /** Minor unit (ör. cent) cinsinden tamsayı tutar. */
  amount: number;
  currency: CurrencyCode;
}

export function money(amount: number, currency: CurrencyCode): Money {
  return { amount: Math.round(amount), currency };
}

/** Minor unit tutarı, locale'e göre biçimlendirilmiş string'e çevirir. */
export function formatMoney(value: Money, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: value.currency,
  }).format(value.amount / 100);
}
