import type { AnalyticsFilterParams } from "@/lib/api";
import {
  useCustomerCac,
  useCustomerCohorts,
  useCustomerLtv,
} from "../hooks/use-customer-analytics";
import { CustomerAnalyticsKpis } from "./customer-analytics-kpis";
import { LifetimeValueCohort } from "./lifetime-value-cohort";

/**
 * Müşteri analitiği bölümü: KPI kartları + "Lifetime Value" kohort grafiği.
 * Üç org-scoped analitik ucu paralel çekilir; orders sayfası başlığının altına gelir.
 */
export function CustomerAnalyticsSection({
  filter,
}: {
  filter: AnalyticsFilterParams;
}) {
  const ltv = useCustomerLtv(filter);
  const cac = useCustomerCac(filter);
  const cohorts = useCustomerCohorts(filter);

  return (
    <div className="space-y-6">
      <CustomerAnalyticsKpis
        ltv={ltv.data}
        cac={cac.data}
        isLoading={ltv.isLoading || cac.isLoading}
      />
      <LifetimeValueCohort
        data={cohorts.data}
        isLoading={cohorts.isLoading}
        currency={ltv.data?.currency}
      />
    </div>
  );
}
