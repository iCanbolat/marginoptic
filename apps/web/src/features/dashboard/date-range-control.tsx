import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { tr } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { formatDateRange } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DateRangeValue {
  from: string;
  to: string;
}

const todayIso = (): string => new Date().toISOString().slice(0, 10);
const daysAgoIso = (n: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};
const startOfMonth = (): string => `${todayIso().slice(0, 7)}-01`;
const startOfYear = (): string => `${todayIso().slice(0, 4)}-01-01`;

const PRESETS: { label: string; range: () => DateRangeValue }[] = [
  { label: "Son 7 gün", range: () => ({ from: daysAgoIso(6), to: todayIso() }) },
  { label: "Son 30 gün", range: () => ({ from: daysAgoIso(29), to: todayIso() }) },
  { label: "Son 90 gün", range: () => ({ from: daysAgoIso(89), to: todayIso() }) },
  { label: "Bu ay", range: () => ({ from: startOfMonth(), to: todayIso() }) },
  { label: "Bu yıl", range: () => ({ from: startOfYear(), to: todayIso() }) },
];

function fromIso(v: string): Date {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DateRangeControl({
  value,
  onChange,
}: {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
}) {
  const [open, setOpen] = useState(false);
  // Popover içinde seçim taslağı — kullanıcı "Uygula"ya basana dek filtreye yansımaz.
  const [draft, setDraft] = useState<DateRange | undefined>({
    from: fromIso(value.from),
    to: fromIso(value.to),
  });

  // Popover her açıldığında taslağı mevcut değere sıfırla.
  useEffect(() => {
    if (open) {
      setDraft({ from: fromIso(value.from), to: fromIso(value.to) });
    }
  }, [open, value.from, value.to]);

  const ready = draft?.from != null && draft?.to != null;

  function apply() {
    if (!draft?.from || !draft?.to) return;
    onChange({ from: toIso(draft.from), to: toIso(draft.to) });
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-3.5" />
          {formatDateRange(value.from, value.to, { style: "short" })}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto space-y-3 p-3" align="end">
        <div className="grid grid-cols-3 gap-1">
          {PRESETS.map((p) => {
            const r = p.range();
            const active =
              draft?.from != null &&
              draft?.to != null &&
              toIso(draft.from) === r.from &&
              toIso(draft.to) === r.to;
            return (
              <Button
                key={p.label}
                variant={active ? "secondary" : "ghost"}
                size="sm"
                className="justify-start"
                onClick={() =>
                  setDraft({ from: fromIso(r.from), to: fromIso(r.to) })
                }
              >
                {p.label}
              </Button>
            );
          })}
        </div>

        <div className="border-t border-border pt-3">
          <Calendar
            mode="range"
            locale={tr}
            selected={draft}
            onSelect={setDraft}
            defaultMonth={draft?.from ?? fromIso(value.from)}
            numberOfMonths={2}
            autoFocus
          />
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            {draft?.from && draft?.to
              ? formatDateRange(toIso(draft.from), toIso(draft.to), {
                  style: "short",
                })
              : draft?.from
                ? "Bitiş tarihi seç"
                : "Tarih aralığı seç"}
          </span>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              İptal
            </Button>
            <Button size="sm" disabled={!ready} onClick={apply}>
              Uygula
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
