import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Settings02Icon,
  Delete02Icon,
  DragDropIcon,
} from "@hugeicons/core-free-icons";
import type { DashboardWidget } from "@churnify/shared";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WIDGET_LABEL, metricMeta } from "./metric-catalog";

/** Widget başlığı: KPI'lar metrik adını kullanır (özel başlık gerekmez). */
function widgetTitle(widget: DashboardWidget): string {
  if (widget.type === "kpi") {
    return metricMeta(widget.config.metric ?? "netProfit").label;
  }
  return widget.config.title?.trim() || WIDGET_LABEL[widget.type];
}

/** Widget kabuğu: başlık + (düzenleme modunda) sürükle/ayar/sil + içerik. */
export function WidgetFrame({
  widget,
  editing,
  dragging = false,
  dragHandleRef,
  onConfigure,
  onRemove,
  children,
}: {
  widget: DashboardWidget;
  editing: boolean;
  /** Sürüklenen widget mi (görsel vurgu için). */
  dragging?: boolean;
  /** dnd-kit sürükleme tutamacı ref'i (yalnızca düzenleme modunda başlığa bağlanır). */
  dragHandleRef?: (element: Element | null) => void;
  onConfigure: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const title = widgetTitle(widget);
  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        dragging && "shadow-lg ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div
          ref={editing ? dragHandleRef : undefined}
          className={cn(
            "flex min-w-0 items-center gap-1.5",
            editing && "cursor-grab touch-none active:cursor-grabbing",
          )}
        >
          {editing && (
            <HugeiconsIcon
              icon={DragDropIcon}
              strokeWidth={2}
              className="size-3.5 shrink-0 text-muted-foreground"
            />
          )}
          <span className="truncate text-sm font-medium">{title}</span>
        </div>
        {editing && (
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onConfigure}
              aria-label="Yapılandır"
            >
              <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRemove}
              aria-label="Kaldır"
              className="text-muted-foreground hover:text-destructive"
            >
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
            </Button>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div>
    </div>
  );
}
