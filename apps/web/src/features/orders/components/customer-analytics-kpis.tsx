import type { CustomerCacResponse, CustomerLtvResponse } from "@churnify/shared";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

const DASH = "—";

function KpiCard({
  label,
  value,
  isLoading,
}: {
  label: string;
  value: string;
  isLoading?: boolean;
}) {
  return (
    <Card className="gap-1.5 px-(--card-spacing)">
      <span className="text-sm text-muted-foreground">{label}</span>
      {isLoading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
      )}
    </Card>
  );
}

/** LTV:CAC oranını "2.05 : 1" biçiminde döndürür; geçersizse tire. */
function ratioLabel(ltv: number, cac: number | null): string {
  if (cac == null || cac <= 0 || !Number.isFinite(ltv)) return DASH;
  return `${(ltv / cac).toFixed(2)} : 1`;
}

export function CustomerAnalyticsKpis({
  ltv,
  cac,
  isLoading,
}: {
  ltv: CustomerLtvResponse | undefined;
  cac: CustomerCacResponse | undefined;
  isLoading: boolean;
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
      />
      <KpiCard
        label="Repurchase Rate"
        isLoading={isLoading}
        value={ltv?.repeatRate != null ? formatPercent(ltv.repeatRate) : DASH}
      />
      <KpiCard
        label="LTV"
        isLoading={isLoading}
        value={ltvValue != null ? formatCurrency(ltvValue, currency) : DASH}
      />
      <KpiCard
        label="CAC"
        isLoading={isLoading}
        value={cacValue != null ? formatCurrency(cacValue, currency) : DASH}
      />
      <KpiCard
        label="LTV:CAC Ratio"
        isLoading={isLoading}
        value={ltvValue != null ? ratioLabel(ltvValue, cacValue) : DASH}
      />
    </div>
  );
}
