import type { AnalyticsFilterParams } from "@/lib/api";
import { formatPercent, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { usePnl } from "../use-analytics";

export function PnlWidget({ filter }: { filter: AnalyticsFilterParams }) {
  const q = usePnl(filter);
  if (q.isLoading) return <Skeleton className="h-full min-h-40 w-full" />;
  if (!q.data)
    return <p className="text-sm text-muted-foreground">Veri yok.</p>;

  const { lines, currency } = q.data;

  return (
    <table className="w-full text-sm">
      <tbody>
        {lines.map((l) => {
          const isResult = l.key === "netProfit" || l.key === "revenue";
          return (
            <tr
              key={l.key}
              className={cn(
                "border-b border-border/50 last:border-0",
                isResult && "font-semibold",
                l.key === "netProfit" && "border-t-2 border-t-border",
              )}
            >
              <td className={cn("py-1.5", l.isCost && "pl-3 text-muted-foreground")}>
                {l.isCost ? "− " : ""}
                {l.label}
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {money(l.amount, currency)}
              </td>
              <td className="w-14 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                {l.pctOfRevenue != null
                  ? formatPercent(l.pctOfRevenue, { fractionDigits: 0 })
                  : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
