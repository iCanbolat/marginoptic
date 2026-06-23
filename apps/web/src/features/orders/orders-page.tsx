import { useEffect, useState } from "react";
import { useStoreSelection } from "@/lib/stores/selection";
import { SyncStatusCard } from "@/features/sync/sync-status-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OrdersFilters } from "./components/orders-filters";
import { OrdersTable } from "./components/orders-table";
import { OrdersEmptyState } from "./components/orders-empty-state";
import { useStores } from "./hooks/use-stores";
import { useOrders } from "./hooks/use-orders";
import { ALL_STATUSES } from "./types/order-types";
import { USE_MOCK_ORDERS } from "./mocks/orders-mock";

export function OrdersPage() {
  const activeStoreId = useStoreSelection((s) => s.activeStoreId);
  const { data: stores = [], isLoading: storesLoading } = useStores();
  const storeId = activeStoreId ?? stores[0]?.id ?? null;

  const [status, setStatus] = useState<string>(ALL_STATUSES);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const orders = useOrders(storeId, {
    financialStatus: status === ALL_STATUSES ? undefined : status,
    search: debouncedSearch || undefined,
  });

  if (!storesLoading && stores.length === 0) {
    return <OrdersEmptyState />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Siparişler</h1>
        <p className="text-sm text-muted-foreground">
          Bağlı mağazadan alınan ham sipariş verisi (iç görünürlük).
        </p>
      </div>

      {/* Mock modda gerçek sync ucu olmadığından eşitleme kartını gizle. */}
      {storeId && !USE_MOCK_ORDERS ? <SyncStatusCard storeId={storeId} /> : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Ham siparişler</CardTitle>
            <OrdersFilters
              search={search}
              onSearchChange={setSearch}
              status={status}
              onStatusChange={setStatus}
            />
          </div>
        </CardHeader>
        <CardContent>
          <OrdersTable
            orders={orders.items}
            isLoading={orders.isLoading}
            isFetching={orders.isFetching}
            total={orders.total}
            pagination={orders.pagination}
            onPaginationChange={orders.setPagination}
          />
        </CardContent>
      </Card>
    </div>
  );
}
