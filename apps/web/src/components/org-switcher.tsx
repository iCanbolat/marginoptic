import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon, UnfoldMoreIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { ApiError, authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth/store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function OrgSwitcher() {
  const qc = useQueryClient();
  const activeOrg = useAuthStore((s) => s.activeOrg);
  const organizations = useAuthStore((s) => s.organizations);
  const setActiveOrg = useAuthStore((s) => s.setActiveOrg);
  const [switching, setSwitching] = useState(false);

  async function handleSwitch(orgId: string): Promise<void> {
    if (orgId === activeOrg?.id || switching) return;
    setSwitching(true);
    try {
      const res = await authApi.switchOrg(orgId);
      setActiveOrg(res.activeOrg, res.accessToken);
      await qc.invalidateQueries();
      toast.success(`${res.activeOrg.name} organizasyonuna geçildi`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Geçiş başarısız");
    } finally {
      setSwitching(false);
    }
  }

  const orgs = organizations.length
    ? organizations
    : activeOrg
      ? [activeOrg]
      : [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="lg" className="max-w-56 justify-between">
          <span className="truncate">{activeOrg?.name ?? "Organizasyon"}</span>
          <HugeiconsIcon icon={UnfoldMoreIcon} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Organizasyonlar</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => void handleSwitch(org.id)}
            className="justify-between"
          >
            <span className="truncate">{org.name}</span>
            {org.id === activeOrg?.id ? (
              <HugeiconsIcon icon={Tick02Icon} />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
