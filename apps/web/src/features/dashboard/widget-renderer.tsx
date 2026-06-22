import type { DashboardWidget } from "@churnify/shared";
import { toParams, type DashFilter } from "./use-analytics";
import { KpiWidget } from "./widgets/kpi-widget";
import { TimeseriesWidget } from "./widgets/timeseries-widget";
import { PnlWidget } from "./widgets/pnl-widget";
import { ProductsWidget } from "./widgets/products-widget";
import { CostBreakdownWidget } from "./widgets/cost-breakdown-widget";
import { ChannelWidget } from "./widgets/channel-widget";
import { CustomMetricWidget } from "./widgets/custom-metric-widget";

/** Widget türünü ilgili bileşene yönlendirir; per-widget dateOverride uygular. */
export function WidgetRenderer({
  widget,
  globalFilter,
}: {
  widget: DashboardWidget;
  globalFilter: DashFilter;
}) {
  const filter = toParams(globalFilter, widget.config.dateOverride ?? null);
  switch (widget.type) {
    case "kpi":
      return <KpiWidget config={widget.config} filter={filter} />;
    case "timeseries":
      return <TimeseriesWidget config={widget.config} filter={filter} />;
    case "pnl":
      return <PnlWidget filter={filter} />;
    case "products":
      return <ProductsWidget config={widget.config} filter={filter} />;
    case "cost_breakdown":
      return <CostBreakdownWidget filter={filter} />;
    case "channel":
      return <ChannelWidget filter={filter} />;
    case "custom_metric":
      return <CustomMetricWidget config={widget.config} filter={filter} />;
    default:
      return null;
  }
}
