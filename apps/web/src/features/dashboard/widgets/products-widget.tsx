import type { WidgetConfig } from "@churnify/shared";
import type { AnalyticsFilterParams } from "@/lib/api";
import { count, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendBadge } from "@/components/trend-badge";
import { useProducts } from "../use-analytics";

export function ProductsWidget({
  config,
  filter,
}: {
  config: WidgetConfig;
  filter: AnalyticsFilterParams;
}) {
  const limit = config.limit ?? 8;
  const q = useProducts(filter, limit);
  if (q.isLoading) return <Skeleton className="h-full min-h-40 w-full" />;
  if (!q.data || q.data.rows.length === 0)
    return (
      <p className="grid h-full place-items-center text-sm text-muted-foreground">
        Ürün verisi yok.
      </p>
    );

  // En az bir satırda trend verisi varsa (compare açık) trend sütununu göster.
  const showTrend = q.data.rows.some((r) => r.netProfitDelta != null);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-muted-foreground">
          <th className="pb-1 text-left font-medium">Ürün</th>
          <th className="pb-1 text-right font-medium">Adet</th>
          <th className="pb-1 text-right font-medium">Net Kâr</th>
          {showTrend && <th className="pb-1 text-right font-medium">Trend</th>}
        </tr>
      </thead>
      <tbody>
        {q.data.rows.map((r) => {
          const net = Number(r.netProfit);
          return (
            <tr
              key={`${r.channelId}-${r.productExternalId}`}
              className="border-b border-border/40 last:border-0"
            >
              <td className="max-w-0 truncate py-1.5 pr-2">
                {r.title ?? r.productExternalId}
              </td>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                {count(r.units)}
              </td>
              <td
                className={cn(
                  "py-1.5 text-right tabular-nums",
                  net < 0 && "text-red-600 dark:text-red-400",
                )}
              >
                {money(r.netProfit, r.currency)}
              </td>
              {showTrend && (
                <td className="py-1.5 pl-2 text-right">
                  {r.netProfitDelta != null ? (
                    <div className="flex justify-end">
                      <TrendBadge delta={r.netProfitDelta} />
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
