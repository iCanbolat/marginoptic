import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  EXPENSE_ALLOCATIONS,
  EXPENSE_RECURRENCES,
  type CustomExpenseInput,
  type CustomExpenseSummary,
  type ExpenseAllocation,
  type ExpenseRecurrence,
  type ExpenseType,
} from "@churnify/shared";
import { expensesApi } from "@/lib/api";
import { errMsg } from "./util";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const RECURRENCE_LABELS: Record<ExpenseRecurrence, string> = {
  daily: "Günlük",
  weekly: "Haftalık",
  monthly: "Aylık",
};
const ALLOCATION_LABELS: Record<ExpenseAllocation, string> = {
  store: "Tek mağaza",
  spread: "Mağazalara yay",
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ExpensesTab({
  activeStoreId,
  canEdit,
}: {
  activeStoreId: string | null;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const key = ["expenses"];
  const q = useQuery({ queryKey: key, queryFn: () => expensesApi.list() });
  const invalidate = () => void qc.invalidateQueries({ queryKey: key });

  const createMut = useMutation({
    mutationFn: (input: CustomExpenseInput) => expensesApi.create(input),
    onSuccess: () => {
      toast.success("Gider eklendi (dağıtım hesaplanıyor)");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, "Gider eklenemedi")),
  });

  const toggleMut = useMutation({
    mutationFn: (e: CustomExpenseSummary) =>
      expensesApi.update(e.id, { active: !e.active }),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(errMsg(e, "Güncellenemedi")),
  });

  const recomputeMut = useMutation({
    mutationFn: (e: CustomExpenseSummary) =>
      expensesApi.materialize(e.id, e.startDate, today()),
    onSuccess: () => toast.success("Yeniden hesaplama kuyruğa alındı"),
    onError: (e) => toast.error(errMsg(e, "İşlem başarısız")),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () => {
      toast.success("Gider silindi");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, "Silinemedi")),
  });

  return (
    <div className="space-y-6">
      {canEdit ? (
        <ExpenseForm
          activeStoreId={activeStoreId}
          pending={createMut.isPending}
          onSubmit={(v) => createMut.mutate(v)}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Özel giderler</CardTitle>
          <CardDescription>
            Yinelenen giderler günlük tutara amortize edilip gün+mağaza
            seviyesine dağıtılır (org genelinde).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : q.data && q.data.length > 0 ? (
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
                {q.data.map((e) => (
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
                        disabled={!canEdit || toggleMut.isPending}
                        onCheckedChange={() => toggleMut.mutate(e)}
                      />
                    </TableCell>
                    {canEdit ? (
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={recomputeMut.isPending}
                          onClick={() => recomputeMut.mutate(e)}
                        >
                          Yeniden hesapla
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deleteMut.isPending}
                          onClick={() => deleteMut.mutate(e.id)}
                        >
                          Sil
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Henüz özel gider yok.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ExpenseForm({
  activeStoreId,
  pending,
  onSubmit,
}: {
  activeStoreId: string | null;
  pending: boolean;
  onSubmit: (v: CustomExpenseInput) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState<ExpenseType>("recurring");
  const [recurrence, setRecurrence] = useState<ExpenseRecurrence>("monthly");
  const [allocation, setAllocation] = useState<ExpenseAllocation>("store");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState("");

  const storeRequired = allocation === "store";
  const missingStore = storeRequired && !activeStoreId;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (missingStore) {
      toast.error("Tek mağaza dağıtımı için üst menüden bir mağaza seçin");
      return;
    }
    onSubmit({
      name: name.trim(),
      category: category.trim() || undefined,
      type,
      recurrence: type === "recurring" ? recurrence : undefined,
      allocation,
      storeId: storeRequired ? (activeStoreId ?? undefined) : undefined,
      amount,
      currency: currency.trim().toUpperCase() || "USD",
      startDate,
      endDate: endDate || undefined,
      active: true,
    });
    setName("");
    setAmount("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Gider ekle</CardTitle>
        <CardDescription>
          Tek seferlik gider yalnız başlangıç gününe; yinelenen gider amortize
          edilerek her güne yazılır.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label>Ad</Label>
            <Input
              required
              value={name}
              placeholder="Kira"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Kategori</Label>
            <Input
              value={category}
              placeholder="opsiyonel"
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Tür</Label>
            <Select value={type} onValueChange={(v) => setType(v as ExpenseType)}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recurring">Yinelenen</SelectItem>
                <SelectItem value="one_time">Tek seferlik</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Sıklık</Label>
            <Select
              value={recurrence}
              disabled={type !== "recurring"}
              onValueChange={(v) => setRecurrence(v as ExpenseRecurrence)}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_RECURRENCES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {RECURRENCE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Dağıtım</Label>
            <Select
              value={allocation}
              onValueChange={(v) => setAllocation(v as ExpenseAllocation)}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_ALLOCATIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {ALLOCATION_LABELS[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {missingStore ? (
              <p className="text-xs text-destructive">Mağaza seçili değil</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label>Tutar</Label>
            <Input
              required
              inputMode="decimal"
              value={amount}
              placeholder="0.00"
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Para</Label>
            <Input
              value={currency}
              maxLength={3}
              onChange={(e) => setCurrency(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Başlangıç</Label>
            <Input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Bitiş (opsiyonel)</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="col-span-2 flex items-end sm:col-span-4">
            <Button type="submit" disabled={pending}>
              Ekle
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
