import type { WidgetConfig } from "@churnify/shared";
import type { AnalyticsFilterParams } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, BarChart, LineChart } from "@/components/charts";
import type { ChartValueKind } from "@/components/charts";
import { useTimeseries } from "../use-analytics";
import { metricMeta, type MetricKind } from "../metric-catalog";

const DEFAULT_METRICS = ["revenue", "netProfit"];

function chartKind(metrics: string[]): ChartValueKind {
  const kinds = new Set<MetricKind>(metrics.map((m) => metricMeta(m).kind));
  if (kinds.size === 1 && kinds.has("number")) return "number";
  if (kinds.size === 1 && kinds.has("percent")) return "percent";
  return "currency";
}

export function TimeseriesWidget({
  config,
  filter,
}: {
  config: WidgetConfig;
  filter: AnalyticsFilterParams;
}) {
  const q = useTimeseries(filter);
  const metrics =
    config.metrics && config.metrics.length > 0
      ? config.metrics
      : DEFAULT_METRICS;
  const visual = config.visual ?? "area";

  if (q.isLoading) return <Skeleton className="h-full min-h-40 w-full" />;
  if (!q.data || q.data.points.length === 0)
    return (
      <p className="grid h-full place-items-center text-sm text-muted-foreground">
        Bu aralıkta veri yok.
      </p>
    );

  const { points, currency } = q.data;
  const data = points.map((p) => {
    const row: Record<string, string | number> = { date: p.date };
    for (const m of metrics) {
      row[m] = Number((p as unknown as Record<string, string>)[m] ?? 0);
    }
    return row;
  });
  const series = metrics.map((m) => ({ key: m, label: metricMeta(m).label }));
  const props = {
    data,
    xKey: "date",
    series,
    kind: chartKind(metrics),
    currency,
    height: 240,
    xFormatter: (v: string | number) =>
      formatDate(String(v), { style: "short" }),
  };

  if (visual === "line") return <LineChart {...props} />;
  if (visual === "bar") return <BarChart {...props} />;
  return <AreaChart {...props} />;
}
