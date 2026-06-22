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
import { WIDGET_LABEL } from "./metric-catalog";

/** Widget kabuğu: başlık + (düzenleme modunda) sürükle/ayar/sil + içerik. */
export function WidgetFrame({
  widget,
  editing,
  onConfigure,
  onRemove,
  children,
}: {
  widget: DashboardWidget;
  editing: boolean;
  onConfigure: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const title = widget.config.title?.trim() || WIDGET_LABEL[widget.type];
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2",
          editing && "widget-drag-handle cursor-move",
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
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
          <div className="widget-no-drag flex shrink-0 items-center gap-0.5">
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
