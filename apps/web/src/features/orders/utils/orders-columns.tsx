import type { ColumnDef } from "@tanstack/react-table";

import { cn, formatMoney, formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/ui/data-table";
import { financialStatusMeta, type OrderRow } from "../types/order-types";

/** Siparişler tablosunun kolon tanımları (TanStack Table). */
export const ordersColumns: ColumnDef<OrderRow>[] = [
  {
    accessorKey: "name",
    header: "Sipariş",
    cell: ({ row }) => {
      const order = row.original;
      return (
        <span className="flex items-center gap-2 font-medium">
          {order.name ?? `#${order.externalId}`}
          {order.test ? (
            <Badge variant="outline" className="text-[10px]">
              test
            </Badge>
          ) : null}
        </span>
      );
    },
  },
  {
    accessorKey: "email",
    header: "Müşteri",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.email ?? "—"}</span>
    ),
  },
  {
    accessorKey: "financialStatus",
    header: "Durum",
    cell: ({ row }) => {
      const meta = financialStatusMeta(row.original.financialStatus);
      return (
        <Badge
          variant="secondary"
          className={cn("border-transparent capitalize", meta.className)}
        >
          {meta.label}
        </Badge>
      );
    },
  },
  {
    id: "totalPrice",
    accessorFn: (order) => Number(order.totalPrice ?? 0),
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Toplam"
        className="ml-auto"
      />
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        {formatMoney(row.original.totalPrice, row.original.currency)}
      </div>
    ),
  },
  {
    id: "totalRefunded",
    accessorFn: (order) => Number(order.totalRefunded ?? 0),
    header: () => <div className="text-right">İade</div>,
    cell: ({ row }) => {
      const { totalRefunded, currency } = row.original;
      return (
        <div className="text-right tabular-nums text-muted-foreground">
          {totalRefunded && Number(totalRefunded) > 0
            ? formatMoney(totalRefunded, currency)
            : "—"}
        </div>
      );
    },
  },
  {
    id: "date",
    accessorFn: (order) =>
      new Date(order.processedAt ?? order.createdAt).getTime(),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tarih" className="ml-auto" />
    ),
    cell: ({ row }) => (
      <div className="text-right text-muted-foreground">
        {formatRelativeTime(row.original.processedAt ?? row.original.createdAt)}
      </div>
    ),
  },
];
