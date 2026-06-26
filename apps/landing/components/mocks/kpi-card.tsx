import { cn } from "@/lib/utils";
import type { Trend } from "@/lib/mock-data";

/** Tiny up/down arrow (inline SVG — avoids depending on an extra icon name). */
function TrendArrow({ positive }: { positive: boolean }) {
  return (
    <svg viewBox="0 0 12 12" className="size-3" fill="none" aria-hidden>
      <path
        d={positive ? "M3 8.5 L7 4.5 L9 6.5 M7 4.5 L7 8" : "M3 4.5 L7 8.5 L9 6.5 M7 8.5 L7 5"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TrendPill({ trend }: { trend: Trend }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-0.5 px-1.5 text-xs font-medium",
        trend.positive
          ? "bg-emerald-500/10 text-emerald-600"
          : "bg-red-500/10 text-red-600",
      )}
    >
      <TrendArrow positive={trend.positive} />
      {trend.value}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  trend,
  className,
}: {
  label: string;
  value: string;
  trend: Trend;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col justify-between gap-2 bg-card p-3 ring-1 ring-foreground/10",
        className,
      )}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-end justify-between gap-2">
        <span className="font-heading text-xl font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        <TrendPill trend={trend} />
      </div>
    </div>
  );
}
