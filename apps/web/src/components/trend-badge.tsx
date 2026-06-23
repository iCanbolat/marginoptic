import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Önceki döneme göre yüzde değişimi gösteren yeşil/kırmızı trend rozeti.
 * shadcn `Badge` üzerine kuruludur. `lowerIsBetter` ile maliyet metriklerinde
 * (azalış = iyi) renk semantiği ters çevrilir.
 */
export function TrendBadge({
  delta,
  lowerIsBetter = false,
  className,
}: {
  delta: number | null | undefined;
  lowerIsBetter?: boolean;
  className?: string;
}) {
  if (delta == null || !Number.isFinite(delta)) return null;
  const positive = delta >= 0;
  const good = lowerIsBetter ? !positive : positive;
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-0.5 tabular-nums",
        good
          ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
          : "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
        className,
      )}
    >
      {positive ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
    </Badge>
  );
}
