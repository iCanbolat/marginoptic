import { useEffect, useState } from "react";
import type { AdProvider } from "@churnify/shared";
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
import { useConnectAds } from "../hooks/use-connect-ads";
import { useStores } from "../hooks/use-stores";
import { AD_LABELS } from "../types/integration-types";

interface ConnectAdsDialogProps {
  /** Açık dialog'un sağlayıcısı; `null` ise kapalı. */
  provider: AdProvider | null;
  onOpenChange: (open: boolean) => void;
}

export function ConnectAdsDialog({
  provider,
  onOpenChange,
}: ConnectAdsDialogProps) {
  const { data: stores = [] } = useStores();
  const { install, devConnect } = useConnectAds();
  const [channelId, setStoreId] = useState("");
  const [account, setAccount] = useState("");

  // Dialog her açıldığında (sağlayıcı değişince) formu sıfırla.
  useEffect(() => {
    setStoreId("");
    setAccount("");
  }, [provider]);

  const label = provider ? AD_LABELS[provider] : "";
  const ready = provider !== null && channelId !== "";

  return (
    <Dialog open={provider !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label} hesabı bağla</DialogTitle>
          <DialogDescription>
            Harcamanın atfedileceği mağazayı seç. OAuth onayı için sağlayıcıya
            yönlendirilirsin.
          </DialogDescription>
        </DialogHeader>

        {stores.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Önce bir satış kanalı (mağaza) bağlamalısın.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Mağaza</Label>
              <Select value={channelId} onValueChange={setStoreId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Mağaza seç" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ad-account">Hesap kimliği</Label>
              <Input
                id="ad-account"
                placeholder="act_123456789"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              />
            </div>

            <DialogFooter>
              {import.meta.env.DEV ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!ready || devConnect.isPending}
                  onClick={() =>
                    provider &&
                    devConnect.mutate(
                      {
                        provider,
                        channelId,
                        externalAccountId: account || "act_demo",
                      },
                      { onSuccess: () => onOpenChange(false) },
                    )
                  }
                >
                  Dev bağla
                </Button>
              ) : null}
              <Button
                type="button"
                disabled={!ready || install.isPending}
                onClick={() =>
                  provider && install.mutate({ provider, channelId })
                }
              >
                Bağla
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
