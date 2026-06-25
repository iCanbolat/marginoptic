import { useEffect, useMemo, useState } from "react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { AdProvider } from "@churnify/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAdEntities,
  useProductLinks,
  useProductLinkMutations,
} from "../hooks/use-product-ad-links";
import type { ProductAnalyticsRow } from "../types/product-types";

/** Manuel eşleştirmede izin verilen reklam sağlayıcılar (Amazon/eBay ↔ Meta/Google). */
const MAP_PROVIDERS: { value: AdProvider; label: string }[] = [
  { value: "meta_ads", label: "Meta Ads" },
  { value: "google_ads", label: "Google Ads" },
];

interface Props {
  /** Eşleştirilecek ürün; `null` ise dialog kapalı. */
  row: ProductAnalyticsRow | null;
  onOpenChange: (open: boolean) => void;
}

export function ProductAdMappingDialog({ row, onOpenChange }: Props) {
  const storeId = row?.storeId ?? null;
  const productId = row?.productExternalId ?? null;

  const [provider, setProvider] = useState<AdProvider>("meta_ads");
  const [entityId, setEntityId] = useState("");

  useEffect(() => {
    setProvider("meta_ads");
    setEntityId("");
  }, [row]);

  const linksQ = useProductLinks(storeId, productId);
  const entitiesQ = useAdEntities(storeId, provider);
  const { create, remove } = useProductLinkMutations(storeId);

  // Eşleştirme için kampanyaları tercih et (yoksa tüm varlıklar).
  const entityOptions = useMemo(() => {
    const all = entitiesQ.data ?? [];
    const campaigns = all.filter((e) => e.level === "campaign");
    return campaigns.length > 0 ? campaigns : all;
  }, [entitiesQ.data]);

  const ready = entityId !== "" && productId != null;

  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent className="*:min-w-0">
        <DialogHeader>
          <DialogTitle>Reklam eşleştir</DialogTitle>
          <DialogDescription>
            {row ? (
              <span className="wrap-break-word">
                {row.title ?? row.productExternalId} — Meta/Google kampanyasını
                bu ürüne bağla. Harcama atfı yeniden hesaplanır.
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {/* Mevcut eşleştirmeler */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Mevcut eşleştirmeler
          </Label>
          {linksQ.isLoading ? (
            <Skeleton className="h-8 w-full" />
          ) : (linksQ.data?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">Henüz eşleştirme yok.</p>
          ) : (
            <ul className="space-y-1">
              {linksQ.data?.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {l.provider === "meta_ads" ? "Meta" : l.provider === "google_ads" ? "Google" : l.provider}
                    </Badge>
                    <span className="truncate text-muted-foreground">
                      {l.adEntityExternalId}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(l.id)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Yeni eşleştirme */}
        <div className="space-y-3 border-t border-border/60 pt-3">
          <div className="space-y-1.5">
            <Label>Reklam platformu</Label>
            <Select
              value={provider}
              onValueChange={(v) => {
                setProvider(v as AdProvider);
                setEntityId("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAP_PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Kampanya</Label>
            <Select
              value={entityId}
              onValueChange={setEntityId}
              disabled={entitiesQ.isLoading || entityOptions.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    entitiesQ.isLoading
                      ? "Yükleniyor…"
                      : entityOptions.length === 0
                        ? "Bu platformda kampanya yok"
                        : "Kampanya seç"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {entityOptions.map((e) => (
                  <SelectItem key={e.externalId} value={e.externalId}>
                    {e.name ?? e.externalId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            disabled={!ready || create.isPending}
            onClick={() =>
              productId &&
              create.mutate(
                {
                  productExternalId: productId,
                  provider,
                  adEntityExternalId: entityId,
                  level: "campaign",
                  weight: 1,
                },
                { onSuccess: () => setEntityId("") },
              )
            }
          >
            Eşleştir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
