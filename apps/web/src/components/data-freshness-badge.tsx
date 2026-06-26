import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowReloadHorizontalIcon } from "@hugeicons/core-free-icons";
import { ingestionApi, channelsApi } from "@/lib/api";
import { useStoreSelection } from "@/lib/stores/selection";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/** Topbar rozeti: aktif (veya ilk) mağazanın veri tazeliği / eşitleme durumu. */
export function DataFreshnessBadge() {
  const activeStoreId = useStoreSelection((s) => s.activeStoreId);
  const { data: stores = [] } = useQuery({
    queryKey: ["stores"],
    queryFn: channelsApi.list,
  });

  const storeId = activeStoreId ?? stores[0]?.id ?? null;

  const q = useQuery({
    queryKey: ["sync", storeId],
    queryFn: () => ingestionApi.syncStatus(storeId as string),
    enabled: storeId != null,
    refetchInterval: (query) => (query.state.data?.complete ? false : 2000),
  });

  if (!storeId || !q.data || q.data.resources.length === 0) return null;

  const syncing = !q.data.complete;
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <HugeiconsIcon
        icon={ArrowReloadHorizontalIcon}
        className={cn("size-3", syncing && "animate-spin")}
      />
      {syncing
        ? "Eşitleniyor…"
        : `${formatRelativeTime(q.data.lastSyncedAt)} güncellendi`}
    </Badge>
  );
}
