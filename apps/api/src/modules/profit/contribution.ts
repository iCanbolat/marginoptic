/**
 * Saf (DB'siz) net katkı formülü — Bölüm 2.4.
 *
 *   Net Kâr = Brüt Satış
 *           − İndirimler − İadeler
 *           − COGS (+ handling)
 *           − Kargo maliyeti
 *           − Ödeme/işlem ücretleri
 *           − Vergiler (üstlenilen)
 *           − Reklam harcaması
 *           − Özel giderler (dağıtılmış)
 *
 * Sipariş-bazında çözülebilenler (COGS, kargo, ödeme ücreti, iade, indirim) sipariş
 * katkısına; çözülemeyenler (reklam, özel giderler) gün+mağaza seviyesine eklenir.
 * Buradaki tutarlar mağaza para birimine FX ile çevrilmiş sayılardır.
 */

/** 4 ondalığa yuvarlanmış sayı (numeric(20,4) ile tutarlı; -0'ı temizler). */
export function round4(n: number): number {
  const r = Math.round((n + Number.EPSILON) * 1e4) / 1e4;
  return r === 0 ? 0 : r;
}

/** Sipariş-seviyesi çözülmüş maliyet girdileri (hepsi mağaza para biriminde). */
export interface OrderContributionInput {
  /** Brüt ürün satışı: Σ satır(price * qty). */
  grossSales: number;
  /** İndirimler (satır + sipariş). */
  discounts: number;
  /** İade tutarı (refunds tablosu toplamı). */
  refunds: number;
  /** Çözülmüş COGS: Σ satır (birim + handling) * qty. */
  cogs: number;
  /** Çözülmüş kargo maliyeti (taşıyıcıya ödenen). */
  shippingCost: number;
  /** Ödeme/işlem ücretleri (gerçek transaction fee veya kural ile çözülmüş). */
  paymentFees: number;
  /** Satıcının üstlendiği satış vergisi (borne değilse 0). */
  taxBorne: number;
}

/** Tek bir siparişin net katkısı (blended giderler hariç). */
export function orderNetContribution(i: OrderContributionInput): number {
  return round4(
    i.grossSales -
      i.discounts -
      i.refunds -
      i.cogs -
      i.shippingCost -
      i.paymentFees -
      i.taxBorne,
  );
}

/** Gün+mağaza toplayıcısı (siparişlerden + blended giderlerden). */
export interface DailyMetricsAccumulator {
  revenue: number;
  discounts: number;
  refunds: number;
  cogs: number;
  shippingCost: number;
  paymentFees: number;
  taxes: number;
  adSpend: number;
  customExpenses: number;
  ordersCount: number;
  units: number;
}

export function emptyDaily(): DailyMetricsAccumulator {
  return {
    revenue: 0,
    discounts: 0,
    refunds: 0,
    cogs: 0,
    shippingCost: 0,
    paymentFees: 0,
    taxes: 0,
    adSpend: 0,
    customExpenses: 0,
    ordersCount: 0,
    units: 0,
  };
}

/** Gün+mağaza net kârı (sipariş katkıları toplamı − blended giderler). */
export function dailyNetProfit(a: DailyMetricsAccumulator): number {
  return round4(
    a.revenue -
      a.discounts -
      a.refunds -
      a.cogs -
      a.shippingCost -
      a.paymentFees -
      a.taxes -
      a.adSpend -
      a.customExpenses,
  );
}

/** Net kâr marjı (% 0..100); ciro 0 ise null. */
export function profitMargin(netProfit: number, revenue: number): number | null {
  if (!Number.isFinite(revenue) || revenue === 0) return null;
  return round4((netProfit / revenue) * 100);
}
