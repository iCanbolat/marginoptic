import type {
  AdLevel,
  AdsPerformanceResponse,
  AnalyticsFilter,
  MetricsTotals,
  PnlResponse,
  ProductRankingResponse,
  ProfitSummaryResponse,
} from "@churnify/shared";

/**
 * Faz 8 — MCP veri sözleşmesi.
 * Tool'ların ihtiyaç duyduğu salt-okunur analytics okumalarını soyutlar; somut
 * implementasyon `apps/api`'de NestJS analytics servisleriyle yapılır (REST ile aynı
 * kod yolu → aynı sonuç). Bu paket NestJS/SDK'dan bağımsızdır.
 */

/** Tool çağrı bağlamı (aktif mağaza (store)). */
export interface McpToolContext {
  storeId: string;
}

/** list_stores satırı. */
export interface McpStoreInfo {
  id: string;
  name: string;
  currency: string;
  channel: string;
}

/** Tek dönemin toplamları (compare_periods için). */
export interface PeriodTotals {
  from: string;
  to: string;
  totals: MetricsTotals;
}

/** İki dönemin karşılaştırması (yüzde değişimlerle). */
export interface ComparePeriodsResult {
  currency: string;
  storeIds: string[];
  a: PeriodTotals;
  b: PeriodTotals;
  /** B'ye göre A→B yüzde değişimleri (B önceki, A güncel kabul edilir). */
  deltas: {
    revenue: number | null;
    netProfit: number | null;
    ordersCount: number | null;
    adSpend: number | null;
    margin: number | null;
  };
}

/** MCP tool'larının çağırdığı veri sağlayıcı. */
export interface McpDataProvider {
  listStores(ctx: McpToolContext): Promise<McpStoreInfo[]>;
  getProfitSummary(
    ctx: McpToolContext,
    filter: AnalyticsFilter,
  ): Promise<ProfitSummaryResponse>;
  getPnl(ctx: McpToolContext, filter: AnalyticsFilter): Promise<PnlResponse>;
  topProductsByProfit(
    ctx: McpToolContext,
    filter: AnalyticsFilter,
    limit: number,
  ): Promise<ProductRankingResponse>;
  getAdPerformance(
    ctx: McpToolContext,
    filter: AnalyticsFilter,
    level: AdLevel,
  ): Promise<AdsPerformanceResponse>;
  comparePeriods(
    ctx: McpToolContext,
    a: { from: string; to: string },
    b: { from: string; to: string },
    storeIds: string[],
  ): Promise<ComparePeriodsResult>;
}
