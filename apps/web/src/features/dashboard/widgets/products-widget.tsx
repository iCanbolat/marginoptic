import type { WidgetConfig } from "@churnify/shared";
import type { AnalyticsFilterParams } from "@/lib/api";
import { count, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
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

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-muted-foreground">
          <th className="pb-1 text-left font-medium">Ürün</th>
          <th className="pb-1 text-right font-medium">Adet</th>
          <th className="pb-1 text-right font-medium">Net Kâr</th>
        </tr>
      </thead>
      <tbody>
        {q.data.rows.map((r) => {
          const net = Number(r.netProfit);
          return (
            <tr key={`${r.storeId}-${r.productExternalId}`} className="border-b border-border/40 last:border-0">
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
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
