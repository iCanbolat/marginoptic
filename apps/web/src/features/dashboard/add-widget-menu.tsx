import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { WIDGET_TYPES, type WidgetType } from "@churnify/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WIDGET_DESCRIPTION, WIDGET_LABEL } from "./metric-catalog";

export function AddWidgetMenu({ onAdd }: { onAdd: (type: WidgetType) => void }) {
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
        {WIDGET_TYPES.map((type) => (
          <DropdownMenuItem
            key={type}
            onSelect={() => onAdd(type)}
            className="flex flex-col items-start gap-0.5"
          >
            <span className="font-medium">{WIDGET_LABEL[type]}</span>
            <span className="text-xs text-muted-foreground">
              {WIDGET_DESCRIPTION[type]}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
