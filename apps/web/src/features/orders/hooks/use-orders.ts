import { useEffect, useMemo, useState } from "react";
import type { PaginationState } from "@tanstack/react-table";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ordersApi } from "../api/orders-api";
import { orderKeys } from "./order-keys";
import { PAGE_SIZE, type OrdersParams } from "../types/order-types";

interface OrdersFilters {
  financialStatus?: string;
  search?: string;
}

/**
 * Offset (sayfa) tabanlı sipariş listesi + sunucu taraflı sayfalama durumu.
 * TanStack Table'ın `PaginationState`'ini yönetir; filtre/mağaza değişince
 * ilk sayfaya döner. Toplam sayım sunucudan gelir (`total`).
 */
export function useOrders(storeId: string | null, filters: OrdersFilters) {
  const { financialStatus, search } = filters;
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  // Filtre/mağaza değişince sayfayı başa al (boyutu koru).
  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [storeId, financialStatus, search]);

  const params = useMemo<OrdersParams>(
    () => ({
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      financialStatus,
      search,
    }),
    [pagination.pageIndex, pagination.pageSize, financialStatus, search],
  );

  const query = useQuery({
    queryKey: orderKeys.list(storeId, params),
    queryFn: () => ordersApi.list(storeId as string, params),
    enabled: storeId != null,
    placeholderData: keepPreviousData,
  });

  return {
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    pagination,
    setPagination,
  };
}
