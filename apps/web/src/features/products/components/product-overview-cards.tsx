import {
  ChartUpIcon,
  Coins01Icon,
  PackageIcon,
  Target02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import { count, money } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CHANNEL_LABELS,
  type ProductOverviewCard,
  type ProductOverviewResponse,
} from "../types/product-types";

interface Props {
  data: ProductOverviewResponse | undefined;
  isLoading: boolean;
}

function pct(value: string | null): string {
  if (value == null) return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return `%${(n * 100).toFixed(2)}`;
}

interface CardSpec {
  key: string;
  label: string;
  icon: IconSvgElement;
  card: ProductOverviewCard | undefined;
  format: (c: ProductOverviewCard) => string;
  /** Conversion kartı: veri yoksa "izleme kur" empty-state. */
  emptyHint?: string;
}

function OverviewCard({ spec, isLoading }: { spec: CardSpec; isLoading: boolean }) {
  const c = spec.card;
  const hasData = c != null && c.value != null && c.productExternalId != null;
  return (
    <Card className="gap-2">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <span className="text-sm text-muted-foreground">{spec.label}</span>
        <HugeiconsIcon
          icon={spec.icon}
          className="size-4 text-muted-foreground"
        />
      </CardHeader>
      <CardContent className="space-y-1">
        {isLoading ? (
          <>
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-4 w-32" />
          </>
        ) : hasData ? (
          <>
            <div className="text-2xl font-semibold tabular-nums">
              {spec.format(c)}
            </div>
            <div className="flex items-center gap-2">
              <span className="truncate text-sm text-muted-foreground">
                {c.title ?? c.productExternalId}
              </span>
              {c.channel ? (
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {CHANNEL_LABELS[c.channel]}
                </Badge>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="text-2xl font-semibold text-muted-foreground">—</div>
            <p className="text-xs text-muted-foreground">
              {spec.emptyHint ?? "Veri yok"}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Overview: 3 platformdan beslenen 4 kart (Etsy hariç). */
export function ProductOverviewCards({ data, isLoading }: Props) {
  const specs: CardSpec[] = [
    {
      key: "units",
      label: "En Çok Satılan (Adet)",
      icon: PackageIcon,
      card: data?.topByUnits,
      format: (c) => count(c.value),
    },
    {
      key: "revenue",
      label: "En Yüksek Ciro",
      icon: ChartUpIcon,
      card: data?.topByRevenue,
      format: (c) => money(c.value, c.currency),
    },
    {
      key: "netProfit",
      label: "En Yüksek Net Kâr",
      icon: Coins01Icon,
      card: data?.topByNetProfit,
      format: (c) => money(c.value, c.currency),
    },
    {
      key: "conversion",
      label: "En Yüksek Dönüşüm",
      icon: Target02Icon,
      card: data?.topByConversionRate,
      format: (c) => pct(c.value),
      emptyHint: "Dönüşüm izlemeyi kur (Shopify Web Pixel / Senkronize et)",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {specs.map((spec) => (
        <OverviewCard key={spec.key} spec={spec} isLoading={isLoading} />
      ))}
    </div>
  );
}
