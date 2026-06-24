import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ebayConnectSchema, type EbayConnectInput } from "@churnify/shared";
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
import { useConnectEbay } from "../hooks/use-connect-ebay";

interface ConnectEbayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectEbayDialog({
  open,
  onOpenChange,
}: ConnectEbayDialogProps) {
  const { install, devConnect } = useConnectEbay();
  const form = useForm<EbayConnectInput>({
    resolver: zodResolver(ebayConnectSchema),
    defaultValues: { shop: "" },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>eBay mağazası bağla</DialogTitle>
          <DialogDescription>
            eBay OAuth onayı için yönlendirilirsin. Satıcı bilgilerin bağlantı
            sonrası otomatik çözülür; veriler periyodik olarak senkronlanır.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button
            className="w-full"
            disabled={install.isPending}
            onClick={() => install.mutate()}
          >
            eBay ile bağlan
          </Button>

          {import.meta.env.DEV ? (
            <form
              onSubmit={form.handleSubmit((v) =>
                devConnect.mutate(v.shop, {
                  onSuccess: () => onOpenChange(false),
                }),
              )}
              className="space-y-3 border-t pt-3"
            >
              <div className="space-y-1.5">
                <Label htmlFor="ebay-shop">Mağaza adı (dev)</Label>
                <Input
                  id="ebay-shop"
                  placeholder="dev: eBay mağaza adı"
                  {...form.register("shop")}
                />
                {form.formState.errors.shop ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.shop.message}
                  </p>
                ) : null}
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={devConnect.isPending}
                >
                  Dev bağla
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
