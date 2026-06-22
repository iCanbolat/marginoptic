import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { OrderRow } from "@churnify/shared";
import { ingestionApi, storesApi } from "@/lib/api";
import { useStoreSelection } from "@/lib/stores/selection";
import { formatMoney, formatRelativeTime } from "@/lib/utils";
import { SyncStatusCard } from "@/features/sync/sync-status-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 25;
const ALL = "__all__";

const FINANCIAL_STATUSES = [
  { value: "paid", label: "Ödendi" },
  { value: "pending", label: "Beklemede" },
  { value: "refunded", label: "İade edildi" },
  { value: "partially_refunded", label: "Kısmi iade" },
  { value: "voided", label: "İptal" },
] as const;

export function OrdersPage() {
  const activeStoreId = useStoreSelection((s) => s.activeStoreId);
  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ["stores"],
    queryFn: storesApi.list,
  });
  const storeId = activeStoreId ?? stores[0]?.id ?? null;

  const [financialStatus, setFinancialStatus] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // Cursor geçmişi: cursors[i] = i. sayfanın başlangıç cursor'u (0 = ilk sayfa).
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Filtre/mağaza değişince sayfalamayı sıfırla.
  useEffect(() => {
    setCursors([undefined]);
    setPage(0);
  }, [storeId, financialStatus, debouncedSearch]);

  const params = useMemo(
    () => ({
      limit: PAGE_SIZE,
      cursor: cursors[page],
      financialStatus: financialStatus === ALL ? undefined : financialStatus,
      search: debouncedSearch || undefined,
    }),
    [cursors, page, financialStatus, debouncedSearch],
  );

  const ordersQ = useQuery({
    queryKey: ["orders", storeId, params],
    queryFn: () => ingestionApi.orders(storeId as string, params),
    enabled: storeId != null,
    placeholderData: keepPreviousData,
  });

  if (!storesLoading && stores.length === 0) {
    return (
      <EmptyState
        title="Mağaza yok"
        body="Sipariş verisi görmek için önce bir Shopify mağazası bağlayın."
      />
    );
  }

  const items = ordersQ.data?.items ?? [];
  const hasNext = ordersQ.data?.nextCursor != null;

  function goNext() {
    const next = ordersQ.data?.nextCursor;
    if (!next) return;
    setCursors((prev) => {
      const copy = prev.slice(0, page + 1);
      copy[page + 1] = next;
      return copy;
    });
    setPage((p) => p + 1);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Siparişler</h1>
        <p className="text-sm text-muted-foreground">
          Bağlı mağazadan alınan ham sipariş verisi (iç görünürlük).
        </p>
      </div>

      {storeId ? <SyncStatusCard storeId={storeId} /> : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Ham siparişler</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Sipariş no / e-posta ara"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-full sm:w-56"
              />
              <Select value={financialStatus} onValueChange={setFinancialStatus}>
                <SelectTrigger size="default" className="h-8 w-full sm:w-44">
                  <SelectValue placeholder="Tüm durumlar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tüm durumlar</SelectItem>
                  {FINANCIAL_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {ordersQ.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sipariş</TableHead>
                  <TableHead>Müşteri</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">Toplam</TableHead>
                  <TableHead className="text-right">İade</TableHead>
                  <TableHead className="text-right">Tarih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((o) => (
                  <OrderTableRow key={o.id} order={o} />
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Bu filtrelerle sipariş bulunamadı.
            </p>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Sayfa {page + 1}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0 || ordersQ.isFetching}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Önceki
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext || ordersQ.isFetching}
                onClick={goNext}
              >
                Sonraki
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OrderTableRow({ order }: { order: OrderRow }) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        <span className="flex items-center gap-2">
          {order.name ?? `#${order.externalId}`}
          {order.test ? (
            <Badge variant="outline" className="text-[10px]">
              test
            </Badge>
          ) : null}
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {order.email ?? "—"}
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="capitalize">
          {order.financialStatus ?? "—"}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMoney(order.totalPrice, order.currency)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        {order.totalRefunded && Number(order.totalRefunded) > 0
          ? formatMoney(order.totalRefunded, order.currency)
          : "—"}
      </TableCell>
      <TableCell className="text-right text-muted-foreground">
        {formatRelativeTime(order.processedAt ?? order.createdAt)}
      </TableCell>
    </TableRow>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{body}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/integrations">Entegrasyonlar</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
