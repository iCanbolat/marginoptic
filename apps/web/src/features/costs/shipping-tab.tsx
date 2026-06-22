import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ShippingRuleInput } from "@churnify/shared";
import { costsApi } from "@/lib/api";
import { errMsg } from "./util";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function range(min: number | null, max: number | null, unit = ""): string {
  if (min == null && max == null) return "—";
  return `${min ?? "0"} – ${max ?? "∞"}${unit}`;
}

export function ShippingTab({
  storeId,
  canEdit,
}: {
  storeId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const key = ["shipping", storeId];
  const rulesQ = useQuery({
    queryKey: key,
    queryFn: () => costsApi.listShipping(storeId),
  });
  const invalidate = () => void qc.invalidateQueries({ queryKey: key });

  const createMut = useMutation({
    mutationFn: (input: ShippingRuleInput) =>
      costsApi.createShipping(storeId, input),
    onSuccess: () => {
      toast.success("Kargo kuralı eklendi");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, "Kural eklenemedi")),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => costsApi.deleteShipping(storeId, id),
    onSuccess: () => {
      toast.success("Kural silindi");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, "Silinemedi")),
  });

  return (
    <div className="space-y-6">
      {canEdit ? (
        <AddForm
          pending={createMut.isPending}
          onSubmit={(v) => createMut.mutate(v)}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kargo kuralları</CardTitle>
          <CardDescription>
            Maliyet = sabit + (adet başı × adet). En özgül eşleşen kural seçilir
            (ülke &gt; adet aralığı).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rulesQ.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : rulesQ.data && rulesQ.data.length > 0 ? (
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
                {rulesQ.data.map((r) => (
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
                          disabled={deleteMut.isPending}
                          onClick={() => deleteMut.mutate(r.id)}
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
              Henüz kargo kuralı yok.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AddForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (v: ShippingRuleInput) => void;
}) {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [minQty, setMinQty] = useState("");
  const [maxQty, setMaxQty] = useState("");
  const [minWeight, setMinWeight] = useState("");
  const [maxWeight, setMaxWeight] = useState("");
  const [baseCost, setBaseCost] = useState("");
  const [perItemCost, setPerItemCost] = useState("");

  const numOpt = (v: string) => (v.trim() === "" ? undefined : Number(v));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      country: country.trim() || undefined,
      minQty: numOpt(minQty),
      maxQty: numOpt(maxQty),
      minWeightGrams: numOpt(minWeight),
      maxWeightGrams: numOpt(maxWeight),
      baseCost: baseCost.trim() || "0",
      perItemCost: perItemCost.trim() || undefined,
    });
    setName("");
    setBaseCost("");
    setPerItemCost("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kargo kuralı ekle</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={submit}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <div className="space-y-1">
            <Label>Ad</Label>
            <Input
              required
              value={name}
              placeholder="Standart"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Ülke (ISO-2)</Label>
            <Input
              value={country}
              maxLength={2}
              placeholder="Tümü"
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Min adet</Label>
            <Input
              inputMode="numeric"
              value={minQty}
              onChange={(e) => setMinQty(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Maks adet</Label>
            <Input
              inputMode="numeric"
              value={maxQty}
              onChange={(e) => setMaxQty(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Min ağırlık (g)</Label>
            <Input
              inputMode="numeric"
              value={minWeight}
              onChange={(e) => setMinWeight(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Maks ağırlık (g)</Label>
            <Input
              inputMode="numeric"
              value={maxWeight}
              onChange={(e) => setMaxWeight(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Sabit maliyet</Label>
            <Input
              inputMode="decimal"
              value={baseCost}
              placeholder="0.00"
              onChange={(e) => setBaseCost(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Adet başı</Label>
            <Input
              inputMode="decimal"
              value={perItemCost}
              placeholder="opsiyonel"
              onChange={(e) => setPerItemCost(e.target.value)}
            />
          </div>
          <div className="col-span-2 sm:col-span-4">
            <Button type="submit" disabled={pending}>
              Ekle
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
