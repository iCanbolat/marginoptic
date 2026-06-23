import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useStoreSelection } from "@/lib/stores/selection";
import { Skeleton } from "@/components/ui/skeleton";
import { AdsFilters } from "./components/ads-filters";
import { AdsSummaryCards } from "./components/ads-summary-cards";
import { AdsPerformanceChart } from "./components/ads-performance-chart";
import { AdsBreakdownTable } from "./components/ads-breakdown-table";
import { AdsEmptyState } from "./components/ads-empty-state";
import { useStores } from "./hooks/use-stores";
import { useAdsPerformance } from "./hooks/use-ads-performance";
import { adKeys } from "./hooks/ad-keys";
import { DEFAULT_LEVEL, type AdLevel } from "./types/ad-types";

const todayIso = (): string => new Date().toISOString().slice(0, 10);

export function AdsPage() {
  const qc = useQueryClient();
  const activeStoreId = useStoreSelection((s) => s.activeStoreId);
  const { data: stores = [] } = useStores();
  const storeId = activeStoreId ?? stores[0]?.id ?? null;
  const currency = stores.find((s) => s.id === storeId)?.currency ?? "USD";

  const [from, setFrom] = useState("2025-01-01");
  const [to, setTo] = useState(todayIso);
  const [level, setLevel] = useState<AdLevel>(DEFAULT_LEVEL);

  // Reklam OAuth dönüşünde ?connected=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      toast.success("Reklam hesabı bağlandı");
      window.history.replaceState({}, "", window.location.pathname);
      void qc.invalidateQueries({ queryKey: adKeys.all });
    }
  }, [qc]);

  const perfQ = useAdsPerformance(storeId, { from, to, level });

  if (!storeId) {
    return (
      <AdsEmptyState text="Reklam performansı için önce bir mağaza bağla (Entegrasyonlar)." />
    );
  }

  const data = perfQ.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reklamlar</h1>
          <p className="text-sm text-muted-foreground">
            Reklam harcaması, ROAS ve POAS (reklama göre net kâr).
          </p>
        </div>
        <AdsFilters
          from={from}
          to={to}
          level={level}
          onFromChange={setFrom}
          onToChange={setTo}
          onLevelChange={setLevel}
        />
      </div>

      {perfQ.isLoading ? (
        <Skeleton className="h-28 w-full" />
      ) : data ? (
        <>
          <AdsSummaryCards summary={data.summary} currency={currency} />
          <AdsPerformanceChart daily={data.daily} currency={currency} />
          <AdsBreakdownTable level={level} rows={data.rows} />
        </>
      ) : (
        <AdsEmptyState text="Reklam verisi yüklenemedi." />
      )}
    </div>
  );
}
