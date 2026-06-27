import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileText, Upload, X } from "lucide-react";
import { costsApi } from "../api/costs-api";
import { errMsg } from "../utils/errors";
import type { CogsCsvImportResult } from "../types/cost-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Şablon başlığı + örnek satırlar (kullanıcı "Şablon indir" ile alır). */
const SAMPLE_HEADER = "sku,cost,handling,currency,country,min_qty";
const SAMPLE_CSV =
  `${SAMPLE_HEADER}\n` +
  "SKU-A,12.50,1,USD,US,1\n" +
  "SKU-B,7,0,,,\n" +
  "SKU-C,3.20,0.5,EUR,DE,2\n";
const MAX_BYTES = 2_000_000;
const MAX_LISTED_ERRORS = 8;

interface CogsCsvImportProps {
  storeId: string;
  onImported: () => void;
}

export function CogsCsvImport({ storeId, onImported }: CogsCsvImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<CogsCsvImportResult | null>(null);

  // Doğrulama sunucuda bellekte çalışır (dryRun); diske hiçbir şey yazılmaz.
  const previewMut = useMutation({
    mutationFn: (text: string) =>
      costsApi.importCogs(storeId, { csv: text, dryRun: true }),
    onSuccess: (res) => setPreview(res),
    onError: (e) => {
      setPreview(null);
      toast.error(errMsg(e, "Önizleme başarısız"));
    },
  });

  const commitMut = useMutation({
    mutationFn: () => costsApi.importCogs(storeId, { csv, dryRun: false }),
    onSuccess: (res) => {
      toast.success(`${res.imported} kural içe aktarıldı`);
      reset();
      onImported();
    },
    onError: (e) => toast.error(errMsg(e, "İçe aktarma başarısız")),
  });

  function reset() {
    setCsv("");
    setFileName(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  /** Dosyayı diske yazmadan doğrudan bellekte okuyup önizlemeyi tetikler. */
  async function ingestFile(file: File) {
    const looksCsv =
      /\.csv$/i.test(file.name) || file.type === "" || file.type.includes("csv");
    if (!looksCsv) {
      toast.error("Lütfen bir .csv dosyası seçin");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Dosya çok büyük (en fazla 2 MB)");
      return;
    }
    const text = await file.text();
    if (!text.trim()) {
      toast.error("Dosya boş");
      return;
    }
    setCsv(text);
    setFileName(file.name);
    previewMut.mutate(text);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void ingestFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void ingestFile(file);
  }

  function downloadTemplate() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cogs-sablon.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const invalidRows = preview?.rows.filter((r) => !r.valid) ?? [];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">CSV ile toplu içe aktar</h3>
        <p className="text-sm text-muted-foreground">
          Dosya diske kaydedilmez; doğrulamalar bellekte çalışır ve yalnızca
          geçerli satırlar veritabanına işlenir.
        </p>
      </div>

      {/* Şablon / beklenen başlık yardımı */}
      <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">Beklenen başlık</span>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={downloadTemplate}
          >
            <Download className="size-3.5" /> Şablon indir
          </Button>
        </div>
        <code className="block overflow-x-auto rounded bg-background px-2 py-1.5 font-mono text-[11px] whitespace-pre">
          {SAMPLE_HEADER}
        </code>
        <p className="text-muted-foreground">
          Zorunlu: <code className="font-mono">sku</code>,{" "}
          <code className="font-mono">cost</code>. İsteğe bağlı: handling,
          currency, country, min_qty. Kolon sırası serbesttir.
        </p>
      </div>

      {/* Dosya bırakma alanı veya seçilen dosya */}
      {fileName ? (
        <div className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{fileName}</span>
            {previewMut.isPending ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                doğrulanıyor…
              </span>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dosyayı kaldır"
            onClick={reset}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-8 text-center transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 outline-none",
            dragActive
              ? "border-ring bg-accent/50"
              : "border-input hover:bg-accent/30",
          )}
        >
          <Upload className="size-5 text-muted-foreground" />
          <div className="text-sm">
            <span className="font-medium text-foreground">Dosya seçin</span>{" "}
            veya buraya sürükleyip bırakın
          </div>
          <p className="text-xs text-muted-foreground">.csv · en fazla 2 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onPick}
          />
        </div>
      )}

      {/* Dosya yerine metin yapıştırma (ikincil yol) */}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Dosya yerine metin yapıştır
        </summary>
        <div className="mt-2 space-y-2">
          <Textarea
            value={csv}
            rows={5}
            placeholder={"sku,cost,handling\nSKU-A,12.50,1\nSKU-B,7,0"}
            className="font-mono text-xs"
            onChange={(e) => {
              setCsv(e.target.value);
              setFileName(null);
              setPreview(null);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!csv.trim() || previewMut.isPending}
            onClick={() => previewMut.mutate(csv)}
          >
            Önizle
          </Button>
        </div>
      </details>

      {/* Önizleme + satır bazlı doğrulama */}
      {preview ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span>
              <span className="font-medium">{preview.total}</span> satır
            </span>
            <span className="text-emerald-600">{preview.valid} geçerli</span>
            <span
              className={
                preview.invalid ? "text-destructive" : "text-muted-foreground"
              }
            >
              {preview.invalid} hatalı
            </span>
          </div>

          {invalidRows.length > 0 ? (
            <div className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
              <p className="font-medium text-destructive">
                Düzeltilmesi gereken satırlar
              </p>
              <ul className="space-y-0.5 text-destructive/90">
                {invalidRows.slice(0, MAX_LISTED_ERRORS).map((r) => (
                  <li key={r.line}>
                    {r.line}. satırdaki {r.error}
                  </li>
                ))}
                {invalidRows.length > MAX_LISTED_ERRORS ? (
                  <li>…ve {invalidRows.length - MAX_LISTED_ERRORS} satır daha</li>
                ) : null}
              </ul>
            </div>
          ) : null}

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
                  <TableRow
                    key={r.line}
                    className={cn(!r.valid && "bg-destructive/5")}
                  >
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

      {/* Eylemler */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          disabled={!csv || commitMut.isPending}
          onClick={reset}
        >
          Temizle
        </Button>
        <Button
          disabled={!preview || preview.valid === 0 || commitMut.isPending}
          onClick={() => commitMut.mutate()}
        >
          {preview ? `${preview.valid} kuralı içe aktar` : "İçe aktar"}
        </Button>
      </div>
    </div>
  );
}
