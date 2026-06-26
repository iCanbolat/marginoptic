import { useEffect, useMemo, useState } from "react";
import { useStoreSelection } from "@/lib/stores/selection";
import { SyncStatusCard } from "@/features/sync/sync-status-card";
import {
  DateRangeControl,
  type DateRangeValue,
} from "@/features/dashboard/date-range-control";
import type { AnalyticsFilterParams } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OrdersFilters } from "./components/orders-filters";
import { OrdersTable } from "./components/orders-table";
import { OrdersEmptyState } from "./components/orders-empty-state";
import { CustomerAnalyticsSection } from "./components/customer-analytics-section";
import { useStores } from "./hooks/use-stores";
import { useOrders } from "./hooks/use-orders";
import { ALL_STATUSES } from "./types/order-types";

const todayIso = (): string => new Date().toISOString().slice(0, 10);
const startOfYearIso = (): string => `${todayIso().slice(0, 4)}-01-01`;

export function OrdersPage() {
  const activeStoreId = useStoreSelection((s) => s.activeStoreId);
  const { data: stores = [], isLoading: storesLoading } = useStores();
  const storeId = activeStoreId ?? stores[0]?.id ?? null;

  const [status, setStatus] = useState<string>(ALL_STATUSES);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [range, setRange] = useState<DateRangeValue>(() => ({
    from: startOfYearIso(),
    to: todayIso(),
  }));

  const analyticsFilter: AnalyticsFilterParams = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      storeIds: activeStoreId ? [activeStoreId] : [],
      compare: true,
    }),
    [range, activeStoreId],
  );

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Siparişler</h1>
          <p className="text-sm text-muted-foreground">
            Bağlı mağazadan alınan ham sipariş verisi (iç görünürlük).
          </p>
        </div>
        <DateRangeControl value={range} onChange={setRange} />
      </div>

      <CustomerAnalyticsSection filter={analyticsFilter} />

      {storeId ? <SyncStatusCard storeId={storeId} /> : null}

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
