import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import "./grid.css";
import type { DashboardWidget } from "@churnify/shared";
import { WidgetFrame } from "./widget-frame";
import { WidgetRenderer } from "./widget-renderer";
import type { DashFilter } from "./use-analytics";

/**
 * Pano ızgarası: dnd-kit sortable + CSS grid. Widget'lar `w` kolon / `h` satır
 * kaplar; düzenleme modunda başlıktan sürükleyerek sıralanır (react-grid-layout
 * yerine — React 19 ile uyumlu, güvenilir sürükle-bırak).
 */
export function DashboardGrid({
  widgets,
  globalFilter,
  editing,
  onReorder,
  onConfigure,
  onRemove,
}: {
  widgets: DashboardWidget[];
  globalFilter: DashFilter;
  editing: boolean;
  onReorder: (next: DashboardWidget[]) => void;
  onConfigure: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return;
        const next = move(widgets, event);
        if (next !== widgets) onReorder(next);
      }}
    >
      <div className="dash-grid">
        {widgets.map((w, index) => (
          <SortableWidget
            key={w.id}
            widget={w}
            index={index}
            editing={editing}
            globalFilter={globalFilter}
            onConfigure={onConfigure}
            onRemove={onRemove}
          />
        ))}
      </div>
    </DragDropProvider>
  );
}

function SortableWidget({
  widget,
  index,
  editing,
  globalFilter,
  onConfigure,
  onRemove,
}: {
  widget: DashboardWidget;
  index: number;
  editing: boolean;
  globalFilter: DashFilter;
  onConfigure: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id: widget.id,
    index,
    disabled: !editing,
  });

  return (
    <div
      ref={ref}
      className="dash-grid-item"
      style={{
        gridColumn: `span ${widget.layout.w}`,
        gridRow: `span ${widget.layout.h}`,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <WidgetFrame
        widget={widget}
        editing={editing}
        dragging={isDragging}
        dragHandleRef={handleRef}
        onConfigure={() => onConfigure(widget.id)}
        onRemove={() => onRemove(widget.id)}
      >
        <WidgetRenderer widget={widget} globalFilter={globalFilter} />
      </WidgetFrame>
    </div>
  );
}
