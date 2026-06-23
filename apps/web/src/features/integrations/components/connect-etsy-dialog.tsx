import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { etsyConnectSchema, type EtsyConnectInput } from "@churnify/shared";
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
import { useConnectEtsy } from "../hooks/use-connect-etsy";

interface ConnectEtsyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectEtsyDialog({
  open,
  onOpenChange,
}: ConnectEtsyDialogProps) {
  const { install, devConnect } = useConnectEtsy();
  const form = useForm<EtsyConnectInput>({
    resolver: zodResolver(etsyConnectSchema),
    defaultValues: { shop: "" },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Etsy mağazası bağla</DialogTitle>
          <DialogDescription>
            Etsy OAuth onayı için yönlendirilirsin (PKCE). Mağaza adın bağlantı
            sonrası otomatik çözülür.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button
            className="w-full"
            disabled={install.isPending}
            onClick={() => install.mutate()}
          >
            Etsy ile bağlan
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
                <Label htmlFor="etsy-shop">Mağaza adı (dev)</Label>
                <Input
                  id="etsy-shop"
                  placeholder="dev: etsy mağaza adı"
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
