import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  COGS_SCOPES,
  type CogsCsvImportResult,
  type CogsRuleInput,
  type CogsScope,
} from "@churnify/shared";
import { costsApi } from "@/lib/api";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const SCOPE_LABELS: Record<CogsScope, string> = {
  sku: "SKU",
  variant: "Varyant",
  product: "Ürün",
  global: "Genel",
};

export function CogsTab({
  storeId,
  canEdit,
}: {
  storeId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const key = ["cogs", storeId];
  const rulesQ = useQuery({
    queryKey: key,
    queryFn: () => costsApi.listCogs(storeId),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: key });

  const createMut = useMutation({
    mutationFn: (input: CogsRuleInput) => costsApi.createCogs(storeId, input),
    onSuccess: () => {
      toast.success("COGS kuralı eklendi");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, "Kural eklenemedi")),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => costsApi.deleteCogs(storeId, id),
    onSuccess: () => {
      toast.success("Kural silindi");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, "Silinemedi")),
  });

  return (
    <div className="space-y-6">
      {canEdit ? (
        <CogsAddForm
          pending={createMut.isPending}
          onSubmit={(v) => createMut.mutate(v)}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">COGS kuralları</CardTitle>
          <CardDescription>
            Çözümleme önceliği: SKU &gt; Varyant &gt; Ürün &gt; Genel. Birim
            maliyet + işleme ücreti satır maliyetine yazılır.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rulesQ.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : rulesQ.data && rulesQ.data.length > 0 ? (
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
                {rulesQ.data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Badge variant="secondary">{SCOPE_LABELS[r.scope]}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.matchValue ?? "—"}
                    </TableCell>
                    <TableCell>{r.country ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.minQty}
                    </TableCell>
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
              Henüz COGS kuralı yok.
            </p>
          )}
        </CardContent>
      </Card>

      {canEdit ? <CsvImport storeId={storeId} onImported={invalidate} /> : null}
    </div>
  );
}

function CogsAddForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (v: CogsRuleInput) => void;
}) {
  const [scope, setScope] = useState<CogsScope>("sku");
  const [matchValue, setMatchValue] = useState("");
  const [costAmount, setCostAmount] = useState("");
  const [handlingFee, setHandlingFee] = useState("");
  const [minQty, setMinQty] = useState("1");
  const [country, setCountry] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      scope,
      matchValue: scope === "global" ? undefined : matchValue.trim(),
      costAmount,
      handlingFee: handlingFee.trim() || undefined,
      minQty: Number(minQty) || 1,
      country: country.trim() || undefined,
    });
    setMatchValue("");
    setCostAmount("");
    setHandlingFee("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kural ekle</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={submit}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        >
          <div className="space-y-1">
            <Label>Kapsam</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as CogsScope)}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COGS_SCOPES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SCOPE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Eşleşme {scope === "global" ? "(yok)" : ""}</Label>
            <Input
              value={matchValue}
              disabled={scope === "global"}
              placeholder={scope === "sku" ? "SKU-123" : "ID"}
              onChange={(e) => setMatchValue(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Birim maliyet</Label>
            <Input
              required
              inputMode="decimal"
              value={costAmount}
              placeholder="0.00"
              onChange={(e) => setCostAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>İşleme ücreti</Label>
            <Input
              inputMode="decimal"
              value={handlingFee}
              placeholder="opsiyonel"
              onChange={(e) => setHandlingFee(e.target.value)}
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
            <Label>Ülke (ISO-2)</Label>
            <Input
              value={country}
              maxLength={2}
              placeholder="TR"
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>
          <div className="col-span-2 sm:col-span-3 lg:col-span-6">
            <Button type="submit" disabled={pending}>
              Ekle
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function CsvImport({
  storeId,
  onImported,
}: {
  storeId: string;
  onImported: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<CogsCsvImportResult | null>(null);

  const previewMut = useMutation({
    mutationFn: () => costsApi.importCogs(storeId, { csv, dryRun: true }),
    onSuccess: (res) => setPreview(res),
    onError: (e) => toast.error(errMsg(e, "Önizleme başarısız")),
  });

  const commitMut = useMutation({
    mutationFn: () => costsApi.importCogs(storeId, { csv, dryRun: false }),
    onSuccess: (res) => {
      toast.success(`${res.imported} kural içe aktarıldı`);
      setPreview(null);
      setCsv("");
      onImported();
    },
    onError: (e) => toast.error(errMsg(e, "İçe aktarma başarısız")),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">CSV ile toplu içe aktar</CardTitle>
        <CardDescription>
          Başlık zorunlu: <code className="font-mono">sku,cost,handling</code>{" "}
          (isteğe bağlı: country, min_qty, currency). Önce önizle, sonra aktar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={csv}
          rows={5}
          placeholder={"sku,cost,handling\nSKU-A,12.50,1\nSKU-B,7,0"}
          className="font-mono text-xs"
          onChange={(e) => {
            setCsv(e.target.value);
            setPreview(null);
          }}
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!csv.trim() || previewMut.isPending}
            onClick={() => previewMut.mutate()}
          >
            Önizle
          </Button>
          <Button
            disabled={
              !preview || preview.valid === 0 || commitMut.isPending
            }
            onClick={() => commitMut.mutate()}
          >
            İçe aktar{preview ? ` (${preview.valid})` : ""}
          </Button>
        </div>

        {preview ? (
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">{preview.total}</span> satır ·{" "}
              <span className="text-emerald-600">{preview.valid} geçerli</span> ·{" "}
              <span className="text-destructive">
                {preview.invalid} hatalı
              </span>
            </p>
            <div className="max-h-64 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Maliyet</TableHead>
                    <TableHead className="text-right">İşleme</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((r) => (
                    <TableRow key={r.line}>
                      <TableCell className="text-muted-foreground">
                        {r.line}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.sku ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.costAmount ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.handlingFee ?? "—"}
                      </TableCell>
                      <TableCell>
                        {r.valid ? (
                          <Badge variant="secondary">geçerli</Badge>
                        ) : (
                          <span className="text-xs text-destructive">
                            {r.error}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
