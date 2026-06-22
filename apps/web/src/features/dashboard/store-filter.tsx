import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { Store01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { storesApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Çok-mağaza filtresi. Boş dizi = org'un tüm mağazaları. */
export function StoreFilter({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data: stores = [] } = useQuery({
    queryKey: ["stores"],
    queryFn: storesApi.list,
  });

  const toggle = (id: string) => {
    onChange(
      value.includes(id) ? value.filter((s) => s !== id) : [...value, id],
    );
  };

  const label =
    value.length === 0
      ? "Tüm mağazalar"
      : value.length === 1
        ? (stores.find((s) => s.id === value[0])?.name ?? "1 mağaza")
        : `${value.length} mağaza`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <HugeiconsIcon icon={Store01Icon} strokeWidth={2} className="size-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-1.5">
        <button
          type="button"
          onClick={() => onChange([])}
          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
        >
          Tüm mağazalar
          {value.length === 0 && (
            <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-3.5" />
          )}
        </button>
        {stores.length > 0 && <div className="my-1 h-px bg-border" />}
        <div className="max-h-64 overflow-auto">
          {stores.map((s) => {
            const checked = value.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                  checked && "font-medium",
                )}
              >
                <span className="truncate">{s.name}</span>
                {checked && (
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    strokeWidth={2}
                    className="size-3.5 shrink-0"
                  />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
