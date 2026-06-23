import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AD_LEVELS, LEVEL_LABEL, type AdLevel } from "../types/ad-types";

interface AdsFiltersProps {
  from: string;
  to: string;
  level: AdLevel;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onLevelChange: (v: AdLevel) => void;
}

/** Tarih aralığı + kırılım seviyesi seçimi. */
export function AdsFilters({
  from,
  to,
  level,
  onFromChange,
  onToChange,
  onLevelChange,
}: AdsFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Başlangıç">
        <DatePicker value={from} onChange={onFromChange} toDate={to} />
      </Field>
      <Field label="Bitiş">
        <DatePicker value={to} onChange={onToChange} fromDate={from} />
      </Field>
      <Field label="Kırılım">
        <Select value={level} onValueChange={(v) => onLevelChange(v as AdLevel)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AD_LEVELS.filter((l) => l !== "account").map((l) => (
              <SelectItem key={l} value={l}>
                {LEVEL_LABEL[l]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="block text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
