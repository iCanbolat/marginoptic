import type { WidgetConfig } from "@churnify/shared";
import type { AnalyticsFilterParams } from "@/lib/api";
import { percentChange } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
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
    return <p className="text-sm text-muted-foreground">Veri yok.</p>;

  const { totals, currency, comparison } = q.data;
  const value = totalValue(totals, metricKey);

  let delta: number | null = null;
  if (config.compare && comparison) {
    const prev = totalValue(comparison.totals, metricKey);
    if (value != null && prev != null) delta = percentChange(value, prev);
  }

  const positive = delta != null && delta >= 0;
  const good = LOWER_IS_BETTER.has(metricKey) ? !positive : positive;

  return (
    <div className="flex h-full flex-col justify-center">
      <div className="truncate text-2xl font-semibold tabular-nums">
        {formatMetric(value, meta.kind, currency)}
      </div>
      {delta != null ? (
        <div
          className={
            good
              ? "mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
              : "mt-1 text-xs font-medium text-red-600 dark:text-red-400"
          }
        >
          {positive ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
          <span className="ml-1 font-normal text-muted-foreground">
            önceki döneme göre
          </span>
        </div>
      ) : (
        <div className="mt-1 text-xs text-muted-foreground">{meta.label}</div>
      )}
    </div>
  );
}
