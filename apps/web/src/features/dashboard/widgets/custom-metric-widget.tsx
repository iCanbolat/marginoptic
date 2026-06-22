import type { WidgetConfig } from "@churnify/shared";
import type { AnalyticsFilterParams } from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomMetricValues } from "../use-analytics";

export function CustomMetricWidget({
  config,
  filter,
}: {
  config: WidgetConfig;
  filter: AnalyticsFilterParams;
}) {
  const q = useCustomMetricValues(filter);
  if (!config.customMetricId)
    return (
      <p className="grid h-full place-items-center text-center text-sm text-muted-foreground">
        Yapılandırmadan bir özel metrik seç.
      </p>
    );
  if (q.isLoading) return <Skeleton className="h-16 w-full" />;

  const cm = q.data?.values.find((v) => v.id === config.customMetricId);
  if (!cm)
    return (
      <p className="grid h-full place-items-center text-sm text-muted-foreground">
        Özel metrik bulunamadı.
      </p>
    );

  const currency = q.data?.currency ?? "USD";
  const display =
    cm.value == null
      ? "—"
      : cm.format === "currency"
        ? formatCurrency(cm.value, currency)
        : cm.format === "percent"
          ? formatPercent(cm.value, { fractionDigits: 1 })
          : formatNumber(cm.value, { fractionDigits: 2 });

  return (
    <div className="flex h-full flex-col justify-center">
      <div className="truncate text-2xl font-semibold tabular-nums">
        {display}
      </div>
      <div className="mt-1 truncate text-xs text-muted-foreground">
        {cm.name}
      </div>
    </div>
  );
}
