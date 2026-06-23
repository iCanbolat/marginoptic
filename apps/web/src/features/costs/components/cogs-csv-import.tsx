import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { costsApi } from "../api/costs-api";
import { errMsg } from "../utils/errors";
import type { CogsCsvImportResult } from "../types/cost-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

interface CogsCsvImportProps {
  storeId: string;
  onImported: () => void;
}

export function CogsCsvImport({ storeId, onImported }: CogsCsvImportProps) {
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
            disabled={!preview || preview.valid === 0 || commitMut.isPending}
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
              <span className="text-destructive">{preview.invalid} hatalı</span>
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
