import { AreaChartMock } from "./area-chart";
import { DonutMock } from "./donut";
import { KpiCard } from "./kpi-card";
import { PnlTableMock } from "./pnl-table";
import { ProductsTableMock } from "./products-table";
import { KPIS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

function Widget({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden bg-card ring-1 ring-foreground/10",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="font-heading text-xs font-medium">{title}</span>
      </div>
      <div className="flex-1 p-3">{children}</div>
    </div>
  );
}

export function DashboardMock() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-12">
      {KPIS.map((kpi) => (
        <div key={kpi.key} className="col-span-1 lg:col-span-3">
          <KpiCard label={kpi.label} value={kpi.display} trend={kpi.trend} />
        </div>
      ))}

      <Widget
        title="Revenue vs Net Profit"
        className="col-span-2 min-h-52.5 lg:col-span-8"
      >
        <AreaChartMock />
      </Widget>

      <Widget
        title="Cost Breakdown"
        className="col-span-2 min-h-52.5 lg:col-span-4"
      >
        <DonutMock />
      </Widget>

      <Widget title="Profit & Loss" className="col-span-2 lg:col-span-5">
        <PnlTableMock />
      </Widget>

      <Widget
        title="Top Products by Profit"
        className="col-span-2 lg:col-span-7"
      >
        <ProductsTableMock variant="compact" limit={5} />
      </Widget>
    </div>
  );
}
