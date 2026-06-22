import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { formatDateRange } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DateRangeValue {
  from: string;
  to: string;
  compare: boolean;
}

const todayIso = (): string => new Date().toISOString().slice(0, 10);
const daysAgoIso = (n: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};
const startOfMonth = (): string => `${todayIso().slice(0, 7)}-01`;
const startOfYear = (): string => `${todayIso().slice(0, 4)}-01-01`;

const PRESETS: { label: string; range: () => { from: string; to: string } }[] = [
  { label: "Son 7 gün", range: () => ({ from: daysAgoIso(6), to: todayIso() }) },
  { label: "Son 30 gün", range: () => ({ from: daysAgoIso(29), to: todayIso() }) },
  { label: "Son 90 gün", range: () => ({ from: daysAgoIso(89), to: todayIso() }) },
  { label: "Bu ay", range: () => ({ from: startOfMonth(), to: todayIso() }) },
  { label: "Bu yıl", range: () => ({ from: startOfYear(), to: todayIso() }) },
];

export function DateRangeControl({
  value,
  onChange,
}: {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-3.5" />
          {formatDateRange(value.from, value.to, { style: "short" })}
          {value.compare && (
            <span className="ml-1 rounded bg-primary/15 px-1 text-[10px] text-primary">
              karşılaştır
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => {
            const r = p.range();
            const active = r.from === value.from && r.to === value.to;
            return (
              <Button
                key={p.label}
                variant={active ? "secondary" : "ghost"}
                size="sm"
                className="justify-start"
                onClick={() => onChange({ ...value, ...r })}
              >
                {p.label}
              </Button>
            );
          })}
        </div>
        <div className="space-y-2 border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className="block text-xs text-muted-foreground">Başlangıç</span>
              <Input
                type="date"
                value={value.from}
                max={value.to}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <span className="block text-xs text-muted-foreground">Bitiş</span>
              <Input
                type="date"
                value={value.to}
                min={value.from}
                onChange={(e) => onChange({ ...value, to: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <Label htmlFor="cmp" className="text-sm font-normal">
              Önceki dönemle karşılaştır
            </Label>
            <Switch
              id="cmp"
              checked={value.compare}
              onCheckedChange={(compare) => onChange({ ...value, compare })}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
