import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_STATUSES, FINANCIAL_STATUSES } from "../types/order-types";

interface OrdersFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
}

export function OrdersFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
}: OrdersFiltersProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input
        placeholder="Sipariş no / e-posta ara"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-8 w-full sm:w-56"
      />
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger size="default" className="h-8 w-full sm:w-44">
          <SelectValue placeholder="Tüm durumlar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_STATUSES}>Tüm durumlar</SelectItem>
          {FINANCIAL_STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
