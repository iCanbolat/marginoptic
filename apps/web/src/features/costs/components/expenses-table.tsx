import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ALLOCATION_LABELS,
  RECURRENCE_LABELS,
  type CustomExpenseSummary,
} from "../types/cost-types";

interface ExpensesTableProps {
  expenses: CustomExpenseSummary[] | undefined;
  isLoading: boolean;
  canEdit: boolean;
  togglePending: boolean;
  recomputePending: boolean;
  deletePending: boolean;
  onToggle: (e: CustomExpenseSummary) => void;
  onRecompute: (e: CustomExpenseSummary) => void;
  onDelete: (id: string) => void;
}

export function ExpensesTable({
  expenses,
  isLoading,
  canEdit,
  togglePending,
  recomputePending,
  deletePending,
  onToggle,
  onRecompute,
  onDelete,
}: ExpensesTableProps) {
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!expenses || expenses.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Henüz özel gider yok.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ad</TableHead>
          <TableHead>Tür</TableHead>
          <TableHead>Dağıtım</TableHead>
          <TableHead className="text-right">Tutar</TableHead>
          <TableHead>Dönem</TableHead>
          <TableHead>Aktif</TableHead>
          {canEdit ? <TableHead /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((e) => (
          <TableRow key={e.id}>
            <TableCell className="font-medium">
              {e.name}
              {e.category ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  {e.category}
                </span>
              ) : null}
            </TableCell>
            <TableCell>
              {e.type === "recurring" && e.recurrence ? (
                <Badge variant="secondary">
                  {RECURRENCE_LABELS[e.recurrence]}
                </Badge>
              ) : (
                <Badge variant="outline">Tek seferlik</Badge>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {ALLOCATION_LABELS[e.allocation]}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {e.amount} {e.currency}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {e.startDate}
              {e.endDate ? ` → ${e.endDate}` : ""}
            </TableCell>
            <TableCell>
              <Switch
                checked={e.active}
                disabled={!canEdit || togglePending}
                onCheckedChange={() => onToggle(e)}
              />
            </TableCell>
            {canEdit ? (
              <TableCell className="text-right whitespace-nowrap">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={recomputePending}
                  onClick={() => onRecompute(e)}
                >
                  Yeniden hesapla
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={deletePending}
                  onClick={() => onDelete(e.id)}
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
