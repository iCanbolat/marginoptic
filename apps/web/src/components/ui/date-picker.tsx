import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { tr } from "date-fns/locale";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** `yyyy-MM-dd` string'i yerel (TZ-kaymasız) bir Date'e çevirir. */
function fromIso(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

/** Yerel bir Date'i `yyyy-MM-dd` string'ine çevirir (TZ-kaymasız). */
function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface DatePickerProps {
  /** `yyyy-MM-dd` biçiminde seçili tarih. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Bu tarihten sonrası seçilemez. */
  toDate?: string;
  /** Bu tarihten öncesi seçilemez. */
  fromDate?: string;
}

/** Tek tarih seçici (shadcn date-picker): Popover + Calendar, ISO string sözleşmesi. */
export function DatePicker({
  value,
  onChange,
  placeholder = "Tarih seç",
  className,
  toDate,
  fromDate,
}: DatePickerProps) {
  const selected = fromIso(value);
  const min = fromIso(fromDate);
  const max = fromIso(toDate);
  const disabled = [
    ...(min ? [{ before: min }] : []),
    ...(max ? [{ after: max }] : []),
  ];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-40 justify-start gap-1.5 font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <HugeiconsIcon
            icon={Calendar03Icon}
            strokeWidth={2}
            className="size-3.5"
          />
          {selected ? formatDate(value, { style: "short" }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={tr}
          selected={selected}
          defaultMonth={selected}
          disabled={disabled.length ? disabled : undefined}
          onSelect={(date) => {
            if (date) onChange(toIso(date));
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
