import { useMemo } from "react";
import type { CustomerCohortsResponse } from "@churnify/shared";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_LOCALE, formatCurrency, formatNumber } from "@/lib/format";

/** "YYYY-MM" → yerelleştirilmiş kısa ay etiketi (ör. "Oca 24"). */
function cohortLabel(cohort: string): string {
  const d = new Date(`${cohort}-01T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return cohort;
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(d);
}

/** Ay sütunu başlığı: 0 → "1st Month", 1 → "2nd Month" ... */
function monthHeader(monthIndex: number): string {
  const n = monthIndex + 1;
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  const suffix = s[(v - 20) % 10] ?? s[v] ?? s[0];
  return `${n}${suffix} Month`;
}

interface ProcessedCell {
  /** Kümülatif müşteri başı ciro; veri yoksa null. */
  ltv: number | null;
}

interface ProcessedRow {
  cohort: string;
  size: number;
  cells: ProcessedCell[];
}

function processCohorts(data: CustomerCohortsResponse): {
  rows: ProcessedRow[];
  maxMonths: number;
  maxLtv: number;
} {
  let maxMonths = 0;
  let maxLtv = 0;

  const rows = data.cohorts.map((row) => {
    const byIndex = new Map<number, number>();
    for (const cell of row.cells) byIndex.set(cell.monthIndex, Number(cell.revenue));

    const span = row.cells.reduce((m, c) => Math.max(m, c.monthIndex + 1), 0);
    maxMonths = Math.max(maxMonths, span);

    let cumulativeRevenue = 0;
    const cells: ProcessedCell[] = [];
    for (let i = 0; i < span; i++) {
      const revenue = byIndex.get(i);
      if (revenue == null) {
        cells.push({ ltv: null });
        continue;
      }
      cumulativeRevenue += revenue;
      const ltv = row.size > 0 ? cumulativeRevenue / row.size : null;
      if (ltv != null) maxLtv = Math.max(maxLtv, ltv);
      cells.push({ ltv });
    }
    return { cohort: row.cohort, size: row.size, cells };
  });

  return { rows, maxMonths, maxLtv };
}

/** Değeri 0..1 yoğunluğa göre tonlanmış arka plan rengi (tema duyarlı). */
function cellBackground(ltv: number, maxLtv: number): string {
  const intensity = maxLtv > 0 ? ltv / maxLtv : 0;
  const pct = Math.round(12 + intensity * 73); // 12%..85%
  return `color-mix(in oklab, var(--primary) ${pct}%, transparent)`;
}

export function LifetimeValueCohort({
  data,
  isLoading,
  currency = "USD",
}: {
  data: CustomerCohortsResponse | undefined;
  isLoading: boolean;
  currency?: string;
}) {
  const processed = useMemo(
    () => (data ? processCohorts(data) : null),
    [data],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lifetime Value</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : !processed || processed.rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Bu dönem için kohort verisi yok.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="grid min-w-max gap-1.5"
              style={{
                gridTemplateColumns: `minmax(150px, max-content) repeat(${processed.maxMonths}, minmax(96px, 1fr))`,
              }}
            >
              {/* Başlık satırı */}
              <div className="text-xs font-medium text-muted-foreground">
                First Purchase
              </div>
              {Array.from({ length: processed.maxMonths }).map((_, i) => (
                <div
                  key={i}
                  className="text-center text-xs font-medium text-muted-foreground"
                >
                  {monthHeader(i)}
                </div>
              ))}

              {/* Kohort satırları */}
              {processed.rows.map((row) => (
                <CohortRowView
                  key={row.cohort}
                  row={row}
                  maxMonths={processed.maxMonths}
                  maxLtv={processed.maxLtv}
                  currency={currency}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CohortRowView({
  row,
  maxMonths,
  maxLtv,
  currency,
}: {
  row: ProcessedRow;
  maxMonths: number;
  maxLtv: number;
  currency: string;
}) {
  return (
    <>
      <div className="flex items-center gap-1.5 text-sm">
        <span className="font-medium">{cohortLabel(row.cohort)}</span>
        <span className="text-muted-foreground">|</span>
        <span className="font-semibold tabular-nums">
          {formatNumber(row.size)}
        </span>
        <span className="text-xs text-muted-foreground">Customer</span>
      </div>
      {Array.from({ length: maxMonths }).map((_, i) => {
        const cell = row.cells[i];
        if (!cell || cell.ltv == null) {
          return <div key={i} />;
        }
        return (
          <div
            key={i}
            className="flex h-9 items-center justify-center rounded-sm text-xs tabular-nums text-foreground"
            style={{ backgroundColor: cellBackground(cell.ltv, maxLtv) }}
            title={formatCurrency(cell.ltv, currency)}
          >
            {formatCurrency(cell.ltv, currency, { compact: true })}
          </div>
        );
      })}
    </>
  );
}
