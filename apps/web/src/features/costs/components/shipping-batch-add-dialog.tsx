import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ShippingRuleInput } from "../types/cost-types";
import { ShippingAddForm } from "./shipping-add-form";

/**
 * Kargo kuralları için stack + batch modalı: kullanıcı formla birden çok kural
 * biriktirir, sonra hepsini tek istekte kaydeder.
 */
export function ShippingBatchAddDialog({
  open,
  onOpenChange,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pending: boolean;
  onSubmit: (rules: ShippingRuleInput[]) => void;
}) {
  const [staged, setStaged] = useState<ShippingRuleInput[]>([]);

  // Modal kapanınca biriktirilen kuralları temizle.
  useEffect(() => {
    if (!open) setStaged([]);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Kargo kuralları ekle</DialogTitle>
          <DialogDescription>
            Formu doldurup “Listeye ekle” ile birden çok kural biriktirin, sonra
            hepsini tek seferde kaydedin.
          </DialogDescription>
        </DialogHeader>

        <ShippingAddForm
          embedded
          submitLabel="Listeye ekle"
          pending={false}
          onSubmit={(v) => setStaged((s) => [...s, v])}
        />

        {staged.length > 0 ? (
          <div className="max-h-64 overflow-auto rounded-none border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad</TableHead>
                  <TableHead>Ülke</TableHead>
                  <TableHead className="text-right">Sabit</TableHead>
                  <TableHead className="text-right">Adet başı</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {staged.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.country ?? "Tümü"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.baseCost ?? "0"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.perItemCost ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setStaged((s) => s.filter((_, idx) => idx !== i))
                        }
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={16} />
                        <span className="sr-only">Kaldır</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="py-2 text-center text-xs text-muted-foreground">
            Henüz kural eklenmedi. Yukarıdaki formla başlayın.
          </p>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {staged.length} kural hazır
          </span>
          <Button
            disabled={staged.length === 0 || pending}
            onClick={() => onSubmit(staged)}
          >
            Tümünü kaydet{staged.length ? ` (${staged.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
