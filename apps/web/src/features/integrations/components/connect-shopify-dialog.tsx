import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { useConnectShopify } from "../hooks/use-connect-shopify";

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
      </DialogContent>
    </Dialog>
  );
}
