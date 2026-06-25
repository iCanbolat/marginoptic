import { useMemo, useState } from "react";
import { Copy01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";
import {
  shopifyInstallSchema,
  type ShopifyInstallInput,
} from "@churnify/shared";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useConnectShopify } from "../hooks/use-connect-shopify";
import { useStores } from "../hooks/use-stores";
import { useStoreTracking } from "../hooks/use-store-tracking";

interface ConnectShopifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectShopifyDialog({
  open,
  onOpenChange,
}: ConnectShopifyDialogProps) {
  const { install, devConnect } = useConnectShopify();
  const form = useForm<ShopifyInstallInput>({
    resolver: zodResolver(shopifyInstallSchema),
    defaultValues: { shop: "" },
  });

  const { data: stores = [] } = useStores();
  const shopifyStores = useMemo(
    () =>
      stores.filter((s) => s.channel === "shopify" && s.status === "active"),
    [stores],
  );
  const [trackingStoreId, setTrackingStoreId] = useState<string>("");
  const trackingQ = useStoreTracking(trackingStoreId || null);

  const copyAccountId = async () => {
    if (!trackingQ.data) return;
    try {
      await navigator.clipboard.writeText(trackingQ.data.accountId);
      toast.success("Account ID kopyalandı");
    } catch {
      toast.error("Kopyalanamadı");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Shopify mağazası bağla</DialogTitle>
          <DialogDescription>
            .myshopify.com alan adını gir. OAuth onayı için Shopify'a
            yönlendirilirsin.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit((v) => install.mutate(v.shop))}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="shopify-shop">Mağaza alan adı</Label>
            <Input
              id="shopify-shop"
              placeholder="magazam.myshopify.com"
              {...form.register("shop")}
            />
            {form.formState.errors.shop ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.shop.message}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            {import.meta.env.DEV ? (
              <Button
                type="button"
                variant="outline"
                disabled={devConnect.isPending}
                onClick={() =>
                  void form.handleSubmit((v) =>
                    devConnect.mutate(v.shop, {
                      onSuccess: () => onOpenChange(false),
                    }),
                  )()
                }
              >
                Dev bağla
              </Button>
            ) : null}
            <Button type="submit" disabled={install.isPending}>
              Shopify'a bağlan
            </Button>
          </DialogFooter>
        </form>

        {shopifyStores.length > 0 ? (
          <div className="space-y-3 border-t border-border/60 pt-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Dönüşüm izleme — Web Pixel</p>
              <p className="text-xs text-muted-foreground">
                MarginOptic Shopify uygulamasını kur, Web Pixel ayarındaki{" "}
                <strong>MarginOptic Account ID</strong> alanına seçtiğin
                mağazanın ID'sini yapıştır.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Shopify mağazası</Label>
              <Select value={trackingStoreId} onValueChange={setTrackingStoreId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Mağaza seç" />
                </SelectTrigger>
                <SelectContent>
                  {shopifyStores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {trackingStoreId ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  MarginOptic Account ID
                </Label>
                <div className="flex items-center gap-2">
                  {trackingQ.isLoading ? (
                    <Skeleton className="h-9 flex-1" />
                  ) : (
                    <code className="flex-1 truncate rounded-md border border-border/60 bg-muted/40 px-3 py-2 font-mono text-sm">
                      {trackingQ.data?.accountId ?? "—"}
                    </code>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1"
                    disabled={!trackingQ.data}
                    onClick={copyAccountId}
                  >
                    <HugeiconsIcon icon={Copy01Icon} className="size-3.5" />
                    Kopyala
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
