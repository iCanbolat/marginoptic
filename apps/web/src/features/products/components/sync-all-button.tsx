import { useEffect, useState } from "react";
import { RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSyncAll, useSyncAllStatus } from "../hooks/use-sync-all";

function fmt(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Tek buton: tüm sağlayıcılardan senkron. Cooldown (15 dk) sunucu tarafında
 * uygulanır; buton kalan süreyi geri sayar ve süre dolana kadar pasif kalır.
 */
export function SyncAllButton() {
  const statusQ = useSyncAllStatus();
  const sync = useSyncAll();
  const [now, setNow] = useState(() => Date.now());

  // Cooldown aktifken saniyede bir geri say.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const nextAt = statusQ.data?.nextAvailableAt
    ? new Date(statusQ.data.nextAvailableAt).getTime()
    : 0;
  const remaining = Math.max(0, nextAt - now);
  const onCooldown = remaining > 0;
  const busy = sync.isPending;

  return (
    <Button
      type="button"
      variant="outline"
      disabled={onCooldown || busy}
      onClick={() => sync.mutate()}
      className="gap-1.5"
      title={
        onCooldown
          ? "Tüm sağlayıcılar yakında tekrar senkronlanabilir"
          : "Tüm sağlayıcılardan senkronize et"
      }
    >
      <HugeiconsIcon
        icon={RefreshIcon}
        className={cn("size-4", busy && "animate-spin")}
      />
      {busy
        ? "Senkronlanıyor…"
        : onCooldown
          ? `Senkron (${fmt(remaining)})`
          : "Senkronize et"}
    </Button>
  );
}
