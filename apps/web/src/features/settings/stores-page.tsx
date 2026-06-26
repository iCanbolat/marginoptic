import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import type { StoreView } from "@churnify/shared";
import { ApiError, authApi, storesApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth/store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type Editing = { mode: "create" } | { mode: "rename"; store: StoreView } | null;

export function StoresPage() {
  const qc = useQueryClient();
  const activeStore = useAuthStore((s) => s.activeStore);
  const setStores = useAuthStore((s) => s.setStores);
  const setActiveStore = useAuthStore((s) => s.setActiveStore);

  const storesQ = useQuery({ queryKey: ["my-stores"], queryFn: storesApi.list });
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState("");

  /** Mutasyon sonrası mağaza listesini (switcher + bu sayfa) tazele. */
  async function refreshStores(): Promise<void> {
    const me = await authApi.me();
    setStores(me.stores);
    qc.setQueryData(["my-stores"], me.stores);
    // Aktif mağaza silindiyse ilk kalan mağazaya geç.
    if (activeStore && !me.stores.some((s) => s.id === activeStore.id)) {
      const next = me.stores[0];
      if (next) {
        const res = await authApi.switchStore(next.id);
        setActiveStore(res.activeStore, res.accessToken);
        await qc.invalidateQueries();
      }
    }
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (editing?.mode === "rename") {
        return storesApi.rename(editing.store.id, trimmed);
      }
      return storesApi.create(trimmed);
    },
    onSuccess: async () => {
      await refreshStores();
      toast.success(editing?.mode === "rename" ? "Mağaza güncellendi" : "Mağaza oluşturuldu");
      setEditing(null);
      setName("");
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "İşlem başarısız"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => storesApi.remove(id),
    onSuccess: async () => {
      await refreshStores();
      toast.success("Mağaza silindi");
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Silinemedi"),
  });

  const stores = storesQ.data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mağazalar</h1>
          <p className="text-sm text-muted-foreground">
            Her mağaza kendi satış kanallarını (Shopify, Amazon, eBay) ve verisini
            kapsar.
          </p>
        </div>
        <Button
          className="gap-1.5"
          onClick={() => {
            setName("");
            setEditing({ mode: "create" });
          }}
        >
          <HugeiconsIcon icon={Add01Icon} className="size-4" />
          Yeni mağaza
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mağazalarım</CardTitle>
          <CardDescription>
            Aktif mağaza üst menüden değiştirilir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {storesQ.isLoading ? (
            <>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </>
          ) : (
            stores.map((store) => (
              <div
                key={store.id}
                className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {store.name}
                    {store.id === activeStore?.id ? (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        Aktif
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Yeniden adlandır"
                    onClick={() => {
                      setName(store.name);
                      setEditing({ mode: "rename", store });
                    }}
                  >
                    <HugeiconsIcon icon={PencilEdit02Icon} className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Sil"
                    disabled={stores.length <= 1 || deleteMut.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `"${store.name}" mağazası ve tüm verisi silinsin mi? Bu işlem geri alınamaz.`,
                        )
                      ) {
                        deleteMut.mutate(store.id);
                      }
                    }}
                  >
                    <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editing != null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.mode === "rename" ? "Mağazayı yeniden adlandır" : "Yeni mağaza"}
            </DialogTitle>
            <DialogDescription>
              Mağaza için bir ad gir.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) saveMut.mutate();
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="store-name">Mağaza adı</Label>
              <Input
                id="store-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn. Foo Store"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!name.trim() || saveMut.isPending}>
                {editing?.mode === "rename" ? "Kaydet" : "Oluştur"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
