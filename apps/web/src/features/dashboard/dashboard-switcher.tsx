import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  StarIcon,
  PlusSignIcon,
  PencilEdit02Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import type { DashboardSummary } from "@churnify/shared";
import { dashboardsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DashboardSwitcher({
  dashboards,
  activeId,
  active,
  canEdit,
  onSelect,
}: {
  dashboards: DashboardSummary[];
  activeId: string | null;
  active: DashboardSummary | undefined;
  canEdit: boolean;
  onSelect: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<"create" | "rename" | null>(null);
  const [name, setName] = useState("");

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["dashboards"] });

  const createMut = useMutation({
    mutationFn: () => dashboardsApi.create({ name }),
    onSuccess: (d) => {
      toast.success("Pano oluşturuldu");
      setDialog(null);
      void invalidate();
      onSelect(d.id);
    },
    onError: () => toast.error("Oluşturulamadı"),
  });

  const renameMut = useMutation({
    mutationFn: () => dashboardsApi.update(activeId as string, { name }),
    onSuccess: () => {
      toast.success("Yeniden adlandırıldı");
      setDialog(null);
      void invalidate();
    },
    onError: () => toast.error("Güncellenemedi"),
  });

  const defaultMut = useMutation({
    mutationFn: () => dashboardsApi.update(activeId as string, { isDefault: true }),
    onSuccess: () => {
      toast.success("Varsayılan yapıldı");
      void invalidate();
    },
    onError: () => toast.error("Güncellenemedi"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => dashboardsApi.remove(id),
    onSuccess: (_d, id) => {
      toast.success("Pano silindi");
      void invalidate();
      if (id === activeId) {
        const next = dashboards.find((d) => d.id !== id);
        if (next) onSelect(next.id);
      }
    },
    onError: () => toast.error("Silinemedi"),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 font-medium">
            {active?.isDefault && (
              <HugeiconsIcon
                icon={StarIcon}
                strokeWidth={2}
                className="size-3.5 text-amber-500"
              />
            )}
            {active?.name ?? "Pano"}
            <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel>Panolar</DropdownMenuLabel>
          {dashboards.map((d) => (
            <DropdownMenuItem
              key={d.id}
              onSelect={() => onSelect(d.id)}
              className="justify-between"
            >
              <span className="truncate">{d.name}</span>
              {d.isDefault && (
                <HugeiconsIcon
                  icon={StarIcon}
                  strokeWidth={2}
                  className="size-3.5 text-amber-500"
                />
              )}
            </DropdownMenuItem>
          ))}
          {canEdit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  setName("");
                  setDialog("create");
                }}
              >
                <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="size-4" />
                Yeni pano
              </DropdownMenuItem>
              {active && (
                <>
                  <DropdownMenuItem
                    onSelect={() => {
                      setName(active.name);
                      setDialog("rename");
                    }}
                  >
                    <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="size-4" />
                    Yeniden adlandır
                  </DropdownMenuItem>
                  {!active.isDefault && (
                    <DropdownMenuItem onSelect={() => defaultMut.mutate()}>
                      <HugeiconsIcon icon={StarIcon} strokeWidth={2} className="size-4" />
                      Varsayılan yap
                    </DropdownMenuItem>
                  )}
                  {dashboards.length > 1 && (
                    <DropdownMenuItem
                      onSelect={() => deleteMut.mutate(active.id)}
                      className="text-destructive"
                    >
                      <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
                      Sil
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog != null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dialog === "create" ? "Yeni Pano" : "Panoyu Yeniden Adlandır"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (dialog === "create") createMut.mutate();
              else renameMut.mutate();
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="dash-name">Ad</Label>
              <Input
                id="dash-name"
                value={name}
                required
                autoFocus
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialog(null)}
              >
                İptal
              </Button>
              <Button type="submit" disabled={!name.trim()}>
                {dialog === "create" ? "Oluştur" : "Kaydet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
