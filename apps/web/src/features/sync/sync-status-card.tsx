import { useQuery } from "@tanstack/react-query";
import type { SyncResourceStatus, SyncStatusValue } from "@churnify/shared";
import { ingestionApi } from "@/lib/api";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const RESOURCE_LABELS: Record<string, string> = {
  orders: "Siparişler",
  products: "Ürünler",
  customers: "Müşteriler",
};

const STATUS_META: Record<
  SyncStatusValue,
  { label: string; variant: "secondary" | "outline" | "destructive"; bar: string }
> = {
  idle: { label: "Bekliyor", variant: "outline", bar: "bg-muted-foreground/30" },
  queued: { label: "Sırada", variant: "outline", bar: "bg-amber-500/60" },
  running: { label: "Çalışıyor", variant: "secondary", bar: "bg-blue-500" },
  done: { label: "Tamam", variant: "secondary", bar: "bg-emerald-500" },
  error: { label: "Hata", variant: "destructive", bar: "bg-destructive" },
};

function percent(r: SyncResourceStatus): number {
  if (r.status === "done") return 100;
  if (r.total && r.total > 0) {
    return Math.min(100, Math.round((r.processed / r.total) * 100));
  }
  return r.status === "running" ? 40 : 0;
}

export function SyncStatusCard({ storeId }: { storeId: string }) {
  const q = useQuery({
    queryKey: ["sync", storeId],
    queryFn: () => ingestionApi.syncStatus(storeId),
    // Tamamlanana kadar canlı yokla; bitince dur.
    refetchInterval: (query) => (query.state.data?.complete ? false : 2000),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Veri eşitleme</CardTitle>
          {q.data ? (
            <Badge variant={q.data.complete ? "secondary" : "outline"}>
              {q.data.complete
                ? `Güncel · ${formatRelativeTime(q.data.lastSyncedAt)}`
                : "Eşitleniyor…"}
            </Badge>
          ) : null}
        </div>
        <CardDescription>
          Shopify backfill ilerlemesi ve veri tazeliği.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : q.data && q.data.resources.length > 0 ? (
          q.data.resources.map((r) => <ResourceRow key={r.resource} r={r} />)
        ) : (
          <p className="text-sm text-muted-foreground">
            Henüz eşitleme kaydı yok. Bağlantı kurulunca backfill başlar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ResourceRow({ r }: { r: SyncResourceStatus }) {
  const meta = STATUS_META[r.status];
  const pct = percent(r);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {RESOURCE_LABELS[r.resource] ?? r.resource}
        </span>
        <div className="flex items-center gap-2">
          <span className="tabular-nums text-xs text-muted-foreground">
            {r.total != null ? `${r.processed}/${r.total}` : r.processed || ""}
          </span>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", meta.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {r.lastError ? (
        <p className="text-xs text-destructive">{r.lastError}</p>
      ) : null}
    </div>
  );
}
