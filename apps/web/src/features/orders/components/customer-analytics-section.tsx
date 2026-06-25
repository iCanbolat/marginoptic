import { useMemo } from "react";
import { percentChange } from "@/lib/format";
import type { AnalyticsFilterParams } from "@/lib/api";
import {
  useCustomerCac,
  useCustomerCohorts,
  useCustomerLtv,
} from "../hooks/use-customer-analytics";
import {
  CustomerAnalyticsKpis,
  type CustomerKpiDeltas,
} from "./customer-analytics-kpis";
import { LifetimeValueCohort } from "./lifetime-value-cohort";

const DAY_MS = 86_400_000;

/** Aralığı bir önceki eşit-uzunluk döneme kaydırır (backend `previousRange` ile aynı). */
function previousRange(from: string, to: string): { from: string; to: string } {
  const f = new Date(`${from}T00:00:00.000Z`);
  const t = new Date(`${to}T00:00:00.000Z`);
  const days = Math.round((t.getTime() - f.getTime()) / DAY_MS) + 1;
  const prevTo = new Date(f.getTime() - DAY_MS);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * DAY_MS);
  return {
    from: prevFrom.toISOString().slice(0, 10),
    to: prevTo.toISOString().slice(0, 10),
  };
}

const ratio = (ltv: number, cac: number | null): number | null =>
  cac != null && cac > 0 ? ltv / cac : null;

const numOrNull = (v: string | null | undefined): number | null =>
  v != null && Number.isFinite(Number(v)) ? Number(v) : null;

/** İki dönem değeri verildiğinde yüzde değişimi; biri eksikse null. */
const delta = (cur: number | null, prev: number | null): number | null =>
  cur != null && prev != null ? percentChange(cur, prev) : null;

/**
 * Müşteri analitiği bölümü: KPI kartları + "Lifetime Value" kohort grafiği.
 * Üç org-scoped analitik ucu paralel çekilir; orders sayfası başlığının altına gelir.
 * Önceki dönem her zaman çekilir; kartlarda trend rozeti gösterilir.
 */
export function CustomerAnalyticsSection({
  filter,
}: {
  filter: AnalyticsFilterParams;
}) {
  const ltv = useCustomerLtv(filter);
  const cac = useCustomerCac(filter);
  const cohorts = useCustomerCohorts(filter);

  const prevFilter = useMemo<AnalyticsFilterParams>(() => {
    const r = previousRange(filter.from, filter.to);
    return { ...filter, from: r.from, to: r.to, compare: false };
  }, [filter]);

  const prevLtv = useCustomerLtv(prevFilter);
  const prevCac = useCustomerCac(prevFilter);

  const deltas = useMemo<CustomerKpiDeltas | undefined>(() => {
    if (!ltv.data || !prevLtv.data) return undefined;
    const curLtv = numOrNull(ltv.data.avgRevenuePerCustomer);
    const prevLtvVal = numOrNull(prevLtv.data.avgRevenuePerCustomer);
    const curCac = numOrNull(cac.data?.cac);
    const prevCacVal = numOrNull(prevCac.data?.cac);
    return {
      customers: delta(ltv.data.customerCount, prevLtv.data.customerCount),
      repeatRate: delta(ltv.data.repeatRate, prevLtv.data.repeatRate),
      ltv: delta(curLtv, prevLtvVal),
      cac: delta(curCac, prevCacVal),
      ltvCacRatio: delta(ratio(curLtv ?? NaN, curCac), ratio(prevLtvVal ?? NaN, prevCacVal)),
    };
  }, [ltv.data, prevLtv.data, cac.data, prevCac.data]);

  return (
    <div className="space-y-6">
      <CustomerAnalyticsKpis
        ltv={ltv.data}
        cac={cac.data}
        isLoading={ltv.isLoading || cac.isLoading}
        deltas={deltas}
      />
      <LifetimeValueCohort
        data={cohorts.data}
        isLoading={cohorts.isLoading}
        currency={ltv.data?.currency}
      />
    </div>
  );
}
