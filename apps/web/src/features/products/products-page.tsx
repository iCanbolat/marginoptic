import { useEffect, useMemo, useState } from "react";
import type { PaginationState } from "@tanstack/react-table";
import { useStoreSelection } from "@/lib/stores/selection";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStores } from "@/features/integrations/hooks/use-stores";
import { ProductOverviewCards } from "./components/product-overview-cards";
import { ProductsTable } from "./components/products-table";
import { ProductAdMappingDialog } from "./components/product-ad-mapping-dialog";
import { SyncAllButton } from "./components/sync-all-button";
import { useProductOverview, useProductTable } from "./hooks/use-product-analytics";
import type {
  ProductAnalyticsRow,
  ProductTableSort,
} from "./types/product-types";

const todayIso = (): string => new Date().toISOString().slice(0, 10);
const startOfYearIso = (): string => `${todayIso().slice(0, 4)}-01-01`;

const SORT_OPTIONS: { value: ProductTableSort; label: string }[] = [
  { value: "netProfit", label: "Net Kâr" },
  { value: "revenue", label: "Ciro" },
  { value: "units", label: "Adet" },
  { value: "adSpend", label: "Reklam Harcaması" },
  { value: "roas", label: "ROAS" },
  { value: "conversionRate", label: "Dönüşüm" },
];

const ALL_CHANNELS = "all";
const CHANNEL_OPTIONS = [
  { value: ALL_CHANNELS, label: "Tüm kanallar" },
  { value: "shopify", label: "Shopify" },
  { value: "amazon", label: "Amazon" },
  { value: "ebay", label: "eBay" },
];

export function ProductsPage() {
  const activeStoreId = useStoreSelection((s) => s.activeStoreId);
  const { data: stores = [], isLoading: storesLoading } = useStores();

  const [range, setRange] = useState<DateRangeValue>(() => ({
    from: startOfYearIso(),
    to: todayIso(),
  }));

  const [sort, setSort] = useState<ProductTableSort>("netProfit");
  const [channel, setChannel] = useState<string>(ALL_CHANNELS);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [mapRow, setMapRow] = useState<ProductAnalyticsRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const filter: AnalyticsFilterParams = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      storeIds: activeStoreId ? [activeStoreId] : [],
    }),
    [range.from, range.to, activeStoreId],
  );

  // Filtre değişince ilk sayfaya dön.
  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [range.from, range.to, activeStoreId, sort, channel, debouncedSearch]);

  const overviewQ = useProductOverview(filter);
  const tableQ = useProductTable({
    ...filter,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sort,
    search: debouncedSearch || undefined,
    channel: channel === ALL_CHANNELS ? undefined : channel,
  });

  if (!storesLoading && stores.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Ürün Analizi</h1>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Önce bir satış kanalı (mağaza) bağla. Ürün verisi senkron sonrası burada
            görünür.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ürün Analizi</h1>
          <p className="text-sm text-muted-foreground">
            Shopify, Amazon ve eBay ürünleri — ROAS, reklam harcaması ve dönüşüm
            (Etsy hariç).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncAllButton />
          <DateRangeControl value={range} onChange={setRange} />
        </div>
      </div>

      <ProductOverviewCards data={overviewQ.data} isLoading={overviewQ.isLoading} />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-base">Ürünler</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Ürün ara…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="sm:w-48"
              />
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={sort}
                onValueChange={(v) => setSort(v as ProductTableSort)}
              >
                <SelectTrigger className="sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      Sırala: {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ProductsTable
            rows={tableQ.data?.rows ?? []}
            total={tableQ.data?.total ?? 0}
            isLoading={tableQ.isLoading}
            isFetching={tableQ.isFetching}
            pagination={pagination}
            onPaginationChange={setPagination}
            onMap={setMapRow}
          />
        </CardContent>
      </Card>

      <ProductAdMappingDialog row={mapRow} onOpenChange={(o) => !o && setMapRow(null)} />
    </div>
  );
}
