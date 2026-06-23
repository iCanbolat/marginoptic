import type { WidgetConfig } from "@churnify/shared";
import type { AnalyticsFilterParams } from "@/lib/api";
import { percentChange } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendBadge } from "@/components/trend-badge";
import { useProfitSummary } from "../use-analytics";
import { formatMetric, metricMeta, totalValue } from "../metric-catalog";

/** Maliyet metrikleri: azalış iyidir (yeşil). */
const LOWER_IS_BETTER = new Set([
  "cogs",
  "shippingCost",
  "paymentFees",
  "taxes",
  "adSpend",
  "customExpenses",
  "discounts",
  "refunds",
]);

export function KpiWidget({
  config,
  filter,
}: {
  config: WidgetConfig;
  filter: AnalyticsFilterParams;
}) {
  const q = useProfitSummary(filter);
  const metricKey = config.metric ?? "netProfit";
  const meta = metricMeta(metricKey);

  if (q.isLoading) return <Skeleton className="h-16 w-full" />;
  if (!q.data)
    return (
      <p className="text-sm text-muted-foreground">Bu dönem için veri yok.</p>
    );

  const { totals, currency, comparison } = q.data;
  const value = totalValue(totals, metricKey);

  let delta: number | null = null;
  if (config.compare && comparison) {
    const prev = totalValue(comparison.totals, metricKey);
    if (value != null && prev != null) delta = percentChange(value, prev);
  }

  return (
    <div className="flex h-full flex-col justify-center gap-1.5">
      <div className="truncate text-3xl font-semibold tabular-nums">
        {formatMetric(value, meta.kind, currency)}
      </div>
      {delta != null && (
        <div className="flex items-center gap-1.5 text-xs">
          <TrendBadge delta={delta} lowerIsBetter={LOWER_IS_BETTER.has(metricKey)} />
          <span className="text-muted-foreground">önceki döneme göre</span>
        </div>
      )}
    </div>
  );
}
