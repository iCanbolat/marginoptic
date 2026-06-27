import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { WIDGET_TYPES, type Feature, type WidgetType } from "@churnify/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProBadge } from "@/components/plan/pro-feature";
import { useFeature } from "@/lib/auth/use-plan";
import { WIDGET_DESCRIPTION, WIDGET_LABEL } from "./metric-catalog";

/** Pro plana özel widget tipleri → gerektirdikleri özellik. */
const WIDGET_FEATURE: Partial<Record<WidgetType, Feature>> = {
  products: "productProfitability",
  custom_metric: "customMetrics",
};

export function AddWidgetMenu({ onAdd }: { onAdd: (type: WidgetType) => void }) {
  const hasProductProfit = useFeature("productProfitability");
  const hasCustomMetrics = useFeature("customMetrics");
  const isLocked = (type: WidgetType): boolean => {
    const feature = WIDGET_FEATURE[type];
    if (!feature) return false;
    return feature === "productProfitability"
      ? !hasProductProfit
      : !hasCustomMetrics;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-1.5">
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="size-3.5" />
          Widget Ekle
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Widget Kütüphanesi</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {WIDGET_TYPES.map((type) => {
          const locked = isLocked(type);
          return (
            <DropdownMenuItem
              key={type}
              disabled={locked}
              onSelect={() => {
                if (!locked) onAdd(type);
              }}
              className="flex flex-col items-start gap-0.5"
            >
              <span className="flex w-full items-center font-medium">
                {WIDGET_LABEL[type]}
                {locked && <ProBadge />}
              </span>
              <span className="text-xs text-muted-foreground">
                {WIDGET_DESCRIPTION[type]}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
