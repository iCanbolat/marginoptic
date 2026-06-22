import { useMemo } from "react";
import { Responsive, WidthProvider, type Layout } from "react-grid-layout";
import "./grid.css";
import type { DashboardWidget } from "@churnify/shared";
import { WidgetFrame } from "./widget-frame";
import { WidgetRenderer } from "./widget-renderer";
import type { DashFilter } from "./use-analytics";

const ResponsiveGrid = WidthProvider(Responsive);

export function DashboardGrid({
  widgets,
  globalFilter,
  editing,
  onLayoutChange,
  onConfigure,
  onRemove,
}: {
  widgets: DashboardWidget[];
  globalFilter: DashFilter;
  editing: boolean;
  onLayoutChange: (layout: Layout[]) => void;
  onConfigure: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const layout = useMemo<Layout[]>(
    () =>
      widgets.map((w) => ({
        i: w.id,
        x: w.layout.x,
        y: w.layout.y,
        w: w.layout.w,
        h: w.layout.h,
        minW: 2,
        minH: 2,
      })),
    [widgets],
  );

  return (
    <ResponsiveGrid
      className="-mx-1"
      layouts={{ lg: layout }}
      breakpoints={{ lg: 0 }}
      cols={{ lg: 12 }}
      rowHeight={64}
      margin={[12, 12]}
      isDraggable={editing}
      isResizable={editing}
      draggableHandle=".widget-drag-handle"
      draggableCancel=".widget-no-drag"
      onLayoutChange={(l: Layout[]) => onLayoutChange(l)}
      compactType="vertical"
    >
      {widgets.map((w) => (
        <div key={w.id}>
          <WidgetFrame
            widget={w}
            editing={editing}
            onConfigure={() => onConfigure(w.id)}
            onRemove={() => onRemove(w.id)}
          >
            <WidgetRenderer widget={w} globalFilter={globalFilter} />
          </WidgetFrame>
        </div>
      ))}
    </ResponsiveGrid>
  );
}
