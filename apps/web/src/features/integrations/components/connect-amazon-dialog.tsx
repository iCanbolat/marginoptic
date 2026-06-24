import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { amazonConnectSchema, type AmazonConnectInput } from "@churnify/shared";
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
import { useConnectAmazon } from "../hooks/use-connect-amazon";

interface ConnectAmazonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectAmazonDialog({
  open,
  onOpenChange,
}: ConnectAmazonDialogProps) {
  const { install, devConnect } = useConnectAmazon();
  const form = useForm<AmazonConnectInput>({
    resolver: zodResolver(amazonConnectSchema),
    defaultValues: { shop: "" },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Amazon mağazası bağla</DialogTitle>
          <DialogDescription>
            Amazon Seller Central yetkilendirmesine yönlendirilirsin. Satıcı
            bilgilerin bağlantı sonrası otomatik çözülür; veriler periyodik olarak
            senkronlanır.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button
            className="w-full"
            disabled={install.isPending}
            onClick={() => install.mutate()}
          >
            Amazon ile bağlan
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
                <Label htmlFor="amazon-shop">Satıcı adı (dev)</Label>
                <Input
                  id="amazon-shop"
                  placeholder="dev: Amazon satıcı adı"
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
