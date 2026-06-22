import type { AnalyticsFilterParams } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { DonutChart, type DonutDatum } from "@/components/charts";
import { usePnl } from "../use-analytics";

/** P&L gider satırlarından donut payları. */
const COST_KEYS = new Set([
  "cogs",
  "shippingCost",
  "paymentFees",
  "taxes",
  "adSpend",
  "customExpenses",
  "discounts",
  "refunds",
]);

export function CostBreakdownWidget({
  filter,
}: {
  filter: AnalyticsFilterParams;
}) {
  const q = usePnl(filter);
  if (q.isLoading) return <Skeleton className="h-full min-h-40 w-full" />;
  if (!q.data)
    return <p className="text-sm text-muted-foreground">Veri yok.</p>;

  const data: DonutDatum[] = q.data.lines
    .filter((l) => COST_KEYS.has(l.key) && Number(l.amount) > 0)
    .map((l) => ({ name: l.label, value: Number(l.amount) }));

  if (data.length === 0)
    return (
      <p className="grid h-full place-items-center text-sm text-muted-foreground">
        Gider verisi yok.
      </p>
    );

  return <DonutChart data={data} currency={q.data.currency} height={240} />;
}
