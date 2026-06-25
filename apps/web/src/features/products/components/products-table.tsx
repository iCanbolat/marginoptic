import { useMemo } from "react";
import type { OnChangeFn, PaginationState } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import type { ProductAnalyticsRow } from "../types/product-types";
import { productColumns } from "../utils/product-columns";

interface Props {
  rows: ProductAnalyticsRow[];
  total: number;
  isLoading: boolean;
  isFetching: boolean;
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  onMap: (row: ProductAnalyticsRow) => void;
}

/** Ürün tablosu (sunucu sayfalaması). */
export function ProductsTable({
  rows,
  total,
  isLoading,
  isFetching,
  pagination,
  onPaginationChange,
  onMap,
}: Props) {
  const columns = useMemo(() => productColumns(onMap), [onMap]);
  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      isFetching={isFetching}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      rowCount={total}
      pageSizeOptions={[10, 25, 50, 100]}
      emptyMessage="Bu aralıkta ürün verisi yok."
    />
  );
}
