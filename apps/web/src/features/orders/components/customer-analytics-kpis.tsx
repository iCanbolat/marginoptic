import type { CustomerCacResponse, CustomerLtvResponse } from "@churnify/shared";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendBadge } from "@/components/trend-badge";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

const DASH = "—";

function KpiCard({
  label,
  value,
  isLoading,
  delta,
  lowerIsBetter,
}: {
  label: string;
  value: string;
  isLoading?: boolean;
  /** Seçilen döneme göre yüzde değişim (compare açıkken); null ise rozet gizlenir. */
  delta?: number | null;
  lowerIsBetter?: boolean;
}) {
  return (
    <Card className="gap-1.5 px-(--card-spacing)">
      <span className="text-sm text-muted-foreground">{label}</span>
      {isLoading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xl font-semibold tabular-nums">{value}</span>
          {delta != null && (
            <TrendBadge delta={delta} lowerIsBetter={lowerIsBetter} />
          )}
        </div>
      )}
    </Card>
  );
}

/** LTV:CAC oranını "2.05 : 1" biçiminde döndürür; geçersizse tire. */
function ratioLabel(ltv: number, cac: number | null): string {
  if (cac == null || cac <= 0 || !Number.isFinite(ltv)) return DASH;
  return `${(ltv / cac).toFixed(2)} : 1`;
}

/** KPI bazında seçilen döneme göre yüzde değişim; compare kapalıysa boş. */
export interface CustomerKpiDeltas {
  customers: number | null;
  repeatRate: number | null;
  ltv: number | null;
  cac: number | null;
  ltvCacRatio: number | null;
}

export function CustomerAnalyticsKpis({
  ltv,
  cac,
  isLoading,
  deltas,
}: {
  ltv: CustomerLtvResponse | undefined;
  cac: CustomerCacResponse | undefined;
  isLoading: boolean;
  deltas?: CustomerKpiDeltas;
}) {
  const currency = ltv?.currency ?? "USD";
  const ltvValue = ltv ? Number(ltv.avgRevenuePerCustomer) : null;
  const cacValue = cac?.cac != null ? Number(cac.cac) : null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        label="Total Customers"
        isLoading={isLoading}
        value={ltv ? formatNumber(ltv.customerCount) : DASH}
        delta={deltas?.customers}
      />
      <KpiCard
        label="Repurchase Rate"
        isLoading={isLoading}
        value={ltv?.repeatRate != null ? formatPercent(ltv.repeatRate) : DASH}
        delta={deltas?.repeatRate}
      />
      <KpiCard
        label="LTV"
        isLoading={isLoading}
        value={ltvValue != null ? formatCurrency(ltvValue, currency) : DASH}
        delta={deltas?.ltv}
      />
      <KpiCard
        label="CAC"
        isLoading={isLoading}
        value={cacValue != null ? formatCurrency(cacValue, currency) : DASH}
        delta={deltas?.cac}
        lowerIsBetter
      />
      <KpiCard
        label="LTV:CAC Ratio"
        isLoading={isLoading}
        value={ltvValue != null ? ratioLabel(ltvValue, cacValue) : DASH}
        delta={deltas?.ltvCacRatio}
      />
    </div>
  );
}
