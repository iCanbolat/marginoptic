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
import { SCOPE_LABELS, type CogsRuleInput } from "../types/cost-types";
import { CogsAddForm } from "./cogs-add-form";

/**
 * COGS kuralları için stack + batch modalı: kullanıcı formla birden çok kural
 * biriktirir, sonra hepsini tek istekte kaydeder.
 */
export function CogsBatchAddDialog({
  open,
  onOpenChange,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pending: boolean;
  onSubmit: (rules: CogsRuleInput[]) => void;
}) {
  const [staged, setStaged] = useState<CogsRuleInput[]>([]);

  // Modal kapanınca biriktirilen kuralları temizle.
  useEffect(() => {
    if (!open) setStaged([]);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>COGS kuralları ekle</DialogTitle>
          <DialogDescription>
            Formu doldurup “Listeye ekle” ile birden çok kural biriktirin, sonra
            hepsini tek seferde kaydedin.
          </DialogDescription>
        </DialogHeader>

        <CogsAddForm
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
                  <TableHead>Kapsam</TableHead>
                  <TableHead>Eşleşme</TableHead>
                  <TableHead className="text-right">Maliyet</TableHead>
                  <TableHead className="text-right">İşleme</TableHead>
                  <TableHead>Ülke</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {staged.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{SCOPE_LABELS[r.scope]}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.matchValue ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.costAmount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.handlingFee ?? "—"}
                    </TableCell>
                    <TableCell>{r.country ?? "—"}</TableCell>
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
