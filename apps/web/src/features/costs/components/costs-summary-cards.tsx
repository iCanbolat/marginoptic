import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  PackageIcon,
  DeliveryTruck01Icon,
  CreditCardIcon,
  PercentIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useCogs } from "../hooks/use-cogs";
import { useShipping } from "../hooks/use-shipping";
import { usePaymentFees } from "../hooks/use-payment-fees";
import { useTax } from "../hooks/use-tax";
import { useExpenses } from "../hooks/use-expenses";

/** Costs sayfasındaki kategori sekmeleri / drill-in hedefleri. */
export type CostCategory =
  | "cogs"
  | "shipping"
  | "payment"
  | "tax"
  | "expenses";

interface SummaryCardProps {
  icon: IconSvgElement;
  label: string;
  value: string;
  sub: string;
  active: boolean;
  loading: boolean;
  onSelect: () => void;
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  active,
  loading,
  onSelect,
}: SummaryCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "group flex flex-col gap-3 rounded-none cursor-pointer border bg-card p-4 text-left ring-1 ring-transparent transition-colors hover:border-foreground/20",
        active
          ? "border-primary/40 ring-primary/30"
          : "border-border/60 ring-transparent",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-none text-muted-foreground transition-colors",
            active && "text-primary",
          )}
        >
          <HugeiconsIcon icon={icon} size={18} strokeWidth={1.8} />
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <span className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </span>
      )}
      <span className="text-xs text-muted-foreground">{sub}</span>
    </button>
  );
}

function avgPercentage(values: Array<{ percentage: string }>): string {
  if (values.length === 0) return "—";
  const sum = values.reduce((acc, v) => acc + Number(v.percentage || 0), 0);
  const avg = sum / values.length;
  return `%${Math.round(avg * 10) / 10}`;
}

export function CostsSummaryCards({
  storeId,
  active,
  onSelect,
}: {
  storeId: string;
  active: CostCategory;
  onSelect: (c: CostCategory) => void;
}) {
  const { rulesQ: cogsQ } = useCogs(storeId);
  const { rulesQ: shippingQ } = useShipping(storeId);
  const { feesQ } = usePaymentFees(storeId);
  const { taxQ } = useTax(storeId);
  const { expensesQ } = useExpenses();

  const taxRate = taxQ.data?.incomeTaxRate;
  const activeExpenses = (expensesQ.data ?? []).filter((e) => e.active).length;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <SummaryCard
        icon={PackageIcon}
        label="COGS"
        value={String(cogsQ.data?.length ?? 0)}
        sub="kural"
        active={active === "cogs"}
        loading={cogsQ.isLoading}
        onSelect={() => onSelect("cogs")}
      />
      <SummaryCard
        icon={DeliveryTruck01Icon}
        label="Kargo"
        value={String(shippingQ.data?.length ?? 0)}
        sub="kural"
        active={active === "shipping"}
        loading={shippingQ.isLoading}
        onSelect={() => onSelect("shipping")}
      />
      <SummaryCard
        icon={CreditCardIcon}
        label="Ödeme"
        value={avgPercentage(feesQ.data ?? [])}
        sub="ort. komisyon"
        active={active === "payment"}
        loading={feesQ.isLoading}
        onSelect={() => onSelect("payment")}
      />
      <SummaryCard
        icon={PercentIcon}
        label="Vergi"
        value={taxRate ? `%${taxRate}` : "—"}
        sub="gelir vergisi"
        active={active === "tax"}
        loading={taxQ.isLoading}
        onSelect={() => onSelect("tax")}
      />
      <SummaryCard
        icon={Wallet01Icon}
        label="Giderler"
        value={String(activeExpenses)}
        sub="aktif gider"
        active={active === "expenses"}
        loading={expensesQ.isLoading}
        onSelect={() => onSelect("expenses")}
      />
    </div>
  );
}
