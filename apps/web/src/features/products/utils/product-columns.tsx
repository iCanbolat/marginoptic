import type { ColumnDef } from "@tanstack/react-table";
import { Link01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { money } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CHANNEL_LABELS,
  MAPPING_LABELS,
  isManualMappable,
  type ProductAnalyticsRow,
} from "../types/product-types";

const roasText = (roas: number | null): string =>
  roas == null ? "—" : `${roas.toFixed(2)}×`;

const pctText = (rate: number | null): string =>
  rate == null ? "—" : `%${(rate * 100).toFixed(2)}`;

const mappingVariant = (
  s: ProductAnalyticsRow["mappingStatus"],
): "secondary" | "outline" =>
  s === "manual" ? "secondary" : "outline";

/**
 * Ürün tablosu kolonları (TanStack Table). Sıralama sunucu tarafında (sayfa
 * üstündeki seçim) yapılır; başlıklar düz. `onMap` Amazon/eBay satırları için
 * manuel eşleştirme dialog'unu açar.
 */
export function productColumns(
  onMap: (row: ProductAnalyticsRow) => void,
): ColumnDef<ProductAnalyticsRow>[] {
  return [
    {
      accessorKey: "title",
      header: "Ürün",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-medium">
              {p.title ?? p.productExternalId}
            </span>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px]">
                {CHANNEL_LABELS[p.channel]}
              </Badge>
              {p.mappingStatus !== "none" ? (
                <Badge
                  variant={mappingVariant(p.mappingStatus)}
                  className="text-[10px]"
                >
                  {MAPPING_LABELS[p.mappingStatus]}
                </Badge>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "units",
      header: () => <div className="text-right">Adet</div>,
      cell: ({ row }) => (
        <div className="text-right tabular-nums text-muted-foreground">
          {row.original.units}
        </div>
      ),
    },
    {
      id: "revenue",
      header: () => <div className="text-right">Ciro</div>,
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {money(row.original.revenue, row.original.currency)}
        </div>
      ),
    },
    {
      id: "adSpend",
      header: () => <div className="text-right">Reklam</div>,
      cell: ({ row }) => (
        <div className="text-right tabular-nums text-muted-foreground">
          {money(row.original.adSpend, row.original.currency)}
        </div>
      ),
    },
    {
      id: "roas",
      header: () => <div className="text-right">ROAS</div>,
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {roasText(row.original.roas)}
        </div>
      ),
    },
    {
      id: "conversionRate",
      header: () => <div className="text-right">Dönüşüm</div>,
      cell: ({ row }) => (
        <div className="text-right tabular-nums text-muted-foreground">
          {pctText(row.original.conversionRate)}
        </div>
      ),
    },
    {
      id: "netProfit",
      header: () => <div className="text-right">Net Kâr</div>,
      cell: ({ row }) => {
        const net = Number(row.original.netProfit);
        return (
          <div
            className={
              net < 0
                ? "text-right tabular-nums text-red-600 dark:text-red-400"
                : "text-right tabular-nums"
            }
          >
            {money(row.original.netProfit, row.original.currency)}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Eşleştir</div>,
      cell: ({ row }) => {
        const p = row.original;
        if (!isManualMappable(p.channel)) {
          return <div className="text-right text-muted-foreground">—</div>;
        }
        return (
          <div className="text-right">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2"
              onClick={() => onMap(p)}
            >
              <HugeiconsIcon icon={Link01Icon} className="size-3.5" />
              Reklam
            </Button>
          </div>
        );
      },
    },
  ];
}
