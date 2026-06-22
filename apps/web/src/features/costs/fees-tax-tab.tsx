import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  PaymentFeeRuleInput,
  TaxConfigInput,
} from "@churnify/shared";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function FeesTaxTab({
  storeId,
  canEdit,
}: {
  storeId: string;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-6">
      <PaymentFees storeId={storeId} canEdit={canEdit} />
      <TaxConfig storeId={storeId} canEdit={canEdit} />
    </div>
  );
}

function PaymentFees({
  storeId,
  canEdit,
}: {
  storeId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const key = ["payment-fees", storeId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => costsApi.listPaymentFees(storeId),
  });
  const invalidate = () => void qc.invalidateQueries({ queryKey: key });

  const [gateway, setGateway] = useState("");
  const [percentage, setPercentage] = useState("");
  const [fixedFee, setFixedFee] = useState("");

  const createMut = useMutation({
    mutationFn: (input: PaymentFeeRuleInput) =>
      costsApi.createPaymentFee(storeId, input),
    onSuccess: () => {
      toast.success("Ödeme ücreti eklendi");
      setGateway("");
      setPercentage("");
      setFixedFee("");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, "Eklenemedi")),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => costsApi.deletePaymentFee(storeId, id),
    onSuccess: () => {
      toast.success("Silindi");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, "Silinemedi")),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ödeme / işlem ücretleri</CardTitle>
        <CardDescription>
          Ücret = tutar × yüzde + sabit. Gateway boşsa tüm gateway'ler için
          varsayılan kuraldır.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMut.mutate({
                gateway: gateway.trim() || undefined,
                percentage: percentage.trim() || "0",
                fixedFee: fixedFee.trim() || "0",
              });
            }}
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            <div className="space-y-1">
              <Label>Gateway</Label>
              <Input
                value={gateway}
                placeholder="shopify_payments"
                onChange={(e) => setGateway(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Yüzde (%)</Label>
              <Input
                inputMode="decimal"
                value={percentage}
                placeholder="2.9"
                onChange={(e) => setPercentage(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Sabit ücret</Label>
              <Input
                inputMode="decimal"
                value={fixedFee}
                placeholder="0.30"
                onChange={(e) => setFixedFee(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={createMut.isPending}>
                Ekle
              </Button>
            </div>
          </form>
        ) : null}

        {q.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : q.data && q.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gateway</TableHead>
                <TableHead className="text-right">Yüzde</TableHead>
                <TableHead className="text-right">Sabit</TableHead>
                {canEdit ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.gateway ?? "Tümü (varsayılan)"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    %{r.percentage}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.fixedFee} {r.currency ?? ""}
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
          <p className="py-4 text-center text-sm text-muted-foreground">
            Henüz ödeme ücreti kuralı yok.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TaxConfig({
  storeId,
  canEdit,
}: {
  storeId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const key = ["tax", storeId];
  const q = useQuery({ queryKey: key, queryFn: () => costsApi.getTax(storeId) });

  const [borne, setBorne] = useState(false);
  const [rate, setRate] = useState("");

  useEffect(() => {
    if (q.data) {
      setBorne(q.data.salesTaxBorne);
      setRate(q.data.incomeTaxRate ?? "");
    }
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: (input: TaxConfigInput) => costsApi.putTax(storeId, input),
    onSuccess: () => {
      toast.success("Vergi ayarı kaydedildi");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(errMsg(e, "Kaydedilemedi")),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vergi ayarı</CardTitle>
        <CardDescription>
          Tahsil edilen satış vergisini satıcı üstleniyorsa maliyete dahil
          edilir. Gelir vergisi oranı net kâra uygulanır (opsiyonel).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMut.mutate({
                salesTaxBorne: borne,
                incomeTaxRate: rate.trim() === "" ? null : rate.trim(),
              });
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Satış vergisini satıcı üstleniyor</Label>
                <p className="text-xs text-muted-foreground">
                  Açıksa toplanan vergi maliyet olarak sayılır.
                </p>
              </div>
              <Switch
                checked={borne}
                disabled={!canEdit}
                onCheckedChange={setBorne}
              />
            </div>
            <div className="max-w-xs space-y-1">
              <Label>Gelir vergisi oranı (%)</Label>
              <Input
                inputMode="decimal"
                value={rate}
                disabled={!canEdit}
                placeholder="örn. 15"
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
            {canEdit ? (
              <Button type="submit" disabled={saveMut.isPending}>
                Kaydet
              </Button>
            ) : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
