import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Settings02Icon,
  Tick02Icon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { ApiError, authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth/store";
import { useStoreSelection } from "@/lib/stores/selection";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Mağaza adından baş harf (daraltılmış sidebar rozeti için). */
function storeInitial(name: string | undefined): string {
  return name?.trim()?.[0]?.toUpperCase() ?? "?";
}

export function StoreSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const qc = useQueryClient();
  const activeStore = useAuthStore((s) => s.activeStore);
  const stores = useAuthStore((s) => s.stores);
  const setActiveStore = useAuthStore((s) => s.setActiveStore);
  const resetChannelFilter = useStoreSelection((s) => s.setActiveStoreId);
  const [switching, setSwitching] = useState(false);

  async function handleSwitch(storeId: string): Promise<void> {
    if (storeId === activeStore?.id || switching) return;
    setSwitching(true);
    try {
      const res = await authApi.switchStore(storeId);
      setActiveStore(res.activeStore, res.accessToken);
      // Kanal filtresi mağazaya özgü; geçişte "tüm kanallar"a dön.
      resetChannelFilter(null);
      await qc.invalidateQueries();
      toast.success(`${res.activeStore.name} mağazasına geçildi`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Geçiş başarısız");
    } finally {
      setSwitching(false);
    }
  }

  const list = stores.length ? stores : activeStore ? [activeStore] : [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {collapsed ? (
          <Button
            variant="outline"
            size="icon-lg"
            className="size-10 font-semibold"
            aria-label={activeStore?.name ?? "Mağaza"}
            title={activeStore?.name ?? "Mağaza"}
          >
            {storeInitial(activeStore?.name)}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="lg"
            className="max-w-56 justify-between"
          >
            <span className="truncate">{activeStore?.name ?? "Mağaza"}</span>
            <HugeiconsIcon icon={UnfoldMoreIcon} />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Mağazalar</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {list.map((store) => (
          <DropdownMenuItem
            key={store.id}
            onSelect={() => void handleSwitch(store.id)}
            className="justify-between"
          >
            <span className="truncate">{store.name}</span>
            {store.id === activeStore?.id ? (
              <HugeiconsIcon icon={Tick02Icon} />
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings/stores" className="gap-2">
            <HugeiconsIcon icon={Add01Icon} className="size-4" />
            Yeni mağaza
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings/stores" className="gap-2">
            <HugeiconsIcon icon={Settings02Icon} className="size-4" />
            Mağazaları yönet
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
