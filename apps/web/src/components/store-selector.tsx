import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon, UnfoldMoreIcon } from "@hugeicons/core-free-icons";
import { channelsApi } from "@/lib/api";
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

const ALL = "__all__";

export function StoreSelector() {
  const { data: stores = [] } = useQuery({
    queryKey: ["stores"],
    queryFn: channelsApi.list,
  });
  const activeStoreId = useStoreSelection((s) => s.activeStoreId);
  const setActiveStoreId = useStoreSelection((s) => s.setActiveStoreId);

  if (stores.length === 0) {
    return (
      <Button variant="outline" size="lg" asChild>
        <Link to="/integrations">Mağaza bağla</Link>
      </Button>
    );
  }

  const active = stores.find((s) => s.id === activeStoreId);
  const label = active ? active.name : "Tüm mağazalar";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="lg" className="max-w-52 justify-between">
          <span className="truncate">{label}</span>
          <HugeiconsIcon icon={UnfoldMoreIcon} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>Mağaza</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => setActiveStoreId(null)}
          className="justify-between"
        >
          Tüm mağazalar
          {activeStoreId === null ? <HugeiconsIcon icon={Tick02Icon} /> : null}
        </DropdownMenuItem>
        {stores.map((store) => (
          <DropdownMenuItem
            key={store.id}
            onSelect={() => setActiveStoreId(store.id)}
            className="justify-between"
          >
            <span className="truncate">{store.name}</span>
            {store.id === activeStoreId ? (
              <HugeiconsIcon icon={Tick02Icon} />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
