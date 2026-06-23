import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ShippingRuleSummary } from "../types/cost-types";
import { range } from "../utils/format";

interface ShippingRulesTableProps {
  rules: ShippingRuleSummary[] | undefined;
  isLoading: boolean;
  canEdit: boolean;
  deletePending: boolean;
  onDelete: (id: string) => void;
}

export function ShippingRulesTable({
  rules,
  isLoading,
  canEdit,
  deletePending,
  onDelete,
}: ShippingRulesTableProps) {
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!rules || rules.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Henüz kargo kuralı yok.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ad</TableHead>
          <TableHead>Ülke</TableHead>
          <TableHead>Adet</TableHead>
          <TableHead>Ağırlık (g)</TableHead>
          <TableHead className="text-right">Sabit</TableHead>
          <TableHead className="text-right">Adet başı</TableHead>
          {canEdit ? <TableHead /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rules.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium">{r.name}</TableCell>
            <TableCell>{r.country ?? "Tümü"}</TableCell>
            <TableCell className="text-muted-foreground">
              {range(r.minQty, r.maxQty)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {range(r.minWeightGrams, r.maxWeightGrams)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {r.baseCost} {r.currency ?? ""}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {r.perItemCost ?? "—"}
            </TableCell>
            {canEdit ? (
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={deletePending}
                  onClick={() => onDelete(r.id)}
                >
                  Sil
                </Button>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
