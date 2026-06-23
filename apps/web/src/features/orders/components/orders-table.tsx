import type { OnChangeFn, PaginationState } from "@tanstack/react-table";

import { DataTable } from "@/components/ui/data-table";
import { ordersColumns } from "../utils/orders-columns";
import { PAGE_SIZE_OPTIONS, type OrderRow } from "../types/order-types";

interface OrdersTableProps {
  orders: OrderRow[];
  isLoading: boolean;
  isFetching: boolean;
  total: number;
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
}

export function OrdersTable({
  orders,
  isLoading,
  isFetching,
  total,
  pagination,
  onPaginationChange,
}: OrdersTableProps) {
  return (
    <DataTable
      columns={ordersColumns}
      data={orders}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyMessage="Bu filtrelerle sipariş bulunamadı."
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      rowCount={total}
      pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
    />
  );
}
