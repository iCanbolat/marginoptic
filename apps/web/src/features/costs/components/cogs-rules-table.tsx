import { Badge } from "@/components/ui/badge";
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
import { SCOPE_LABELS, type CogsRuleSummary } from "../types/cost-types";

interface CogsRulesTableProps {
  rules: CogsRuleSummary[] | undefined;
  isLoading: boolean;
  canEdit: boolean;
  deletePending: boolean;
  onDelete: (id: string) => void;
}

export function CogsRulesTable({
  rules,
  isLoading,
  canEdit,
  deletePending,
  onDelete,
}: CogsRulesTableProps) {
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!rules || rules.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Henüz COGS kuralı yok.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Kapsam</TableHead>
          <TableHead>Eşleşme</TableHead>
          <TableHead>Ülke</TableHead>
          <TableHead className="text-right">Min adet</TableHead>
          <TableHead className="text-right">Birim maliyet</TableHead>
          <TableHead className="text-right">İşleme</TableHead>
          <TableHead>Kaynak</TableHead>
          {canEdit ? <TableHead /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rules.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <Badge variant="secondary">{SCOPE_LABELS[r.scope]}</Badge>
            </TableCell>
            <TableCell className="font-mono text-xs">
              {r.matchValue ?? "—"}
            </TableCell>
            <TableCell>{r.country ?? "—"}</TableCell>
            <TableCell className="text-right tabular-nums">{r.minQty}</TableCell>
            <TableCell className="text-right tabular-nums">
              {r.costAmount} {r.currency ?? ""}
            </TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              {r.handlingFee ?? "—"}
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="text-[10px]">
                {r.source}
              </Badge>
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
