import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, FunctionIcon } from "@hugeicons/core-free-icons";
import {
  CUSTOM_METRIC_FIELDS,
  type CustomMetricFormat,
} from "@churnify/shared";
import { ApiError, customMetricsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FORMAT_LABEL: Record<CustomMetricFormat, string> = {
  currency: "Para",
  number: "Sayı",
  percent: "Yüzde",
};

export function CustomMetricsDialog({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [formula, setFormula] = useState("");
  const [format, setFormat] = useState<CustomMetricFormat>("number");
  const [formulaError, setFormulaError] = useState<string | null>(null);

  const { data: metrics = [] } = useQuery({
    queryKey: ["custom-metrics"],
    queryFn: customMetricsApi.list,
    enabled: open,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["custom-metrics"] });
    void qc.invalidateQueries({ queryKey: ["analytics", "custom-metric-values"] });
  };

  const createMut = useMutation({
    mutationFn: () => customMetricsApi.create({ name, formula, format }),
    onSuccess: () => {
      toast.success("Özel metrik eklendi");
      setName("");
      setFormula("");
      setFormulaError(null);
      invalidate();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const issue = err.issues?.find((i) => i.path === "formula");
        if (issue) setFormulaError(issue.message);
        toast.error(err.message);
      } else {
        toast.error("Eklenemedi");
      }
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => customMetricsApi.remove(id),
    onSuccess: () => {
      toast.success("Silindi");
      invalidate();
    },
    onError: () => toast.error("Silinemedi"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <HugeiconsIcon icon={FunctionIcon} strokeWidth={2} className="size-3.5" />
          Özel Metrikler
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Özel Metrikler</DialogTitle>
          <DialogDescription>
            Whitelist alanlardan formül kur (ör. <code>netProfit / ordersCount</code>).
            Operatörler: + − * / ve parantez.
          </DialogDescription>
        </DialogHeader>

        {metrics.length > 0 && (
          <div className="space-y-1.5">
            {metrics.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{m.name}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground">
                    {m.formula} · {FORMAT_LABEL[m.format]}
                  </div>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMut.mutate(m.id)}
                    aria-label="Sil"
                  >
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {canEdit ? (
          <form
            className="space-y-3 border-t border-border pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              setFormulaError(null);
              createMut.mutate();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cm-name">Ad</Label>
                <Input
                  id="cm-name"
                  value={name}
                  required
                  placeholder="Örn. AOV"
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Format</Label>
                <Select
                  value={format}
                  onValueChange={(v) => setFormat(v as CustomMetricFormat)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FORMAT_LABEL) as CustomMetricFormat[]).map(
                      (f) => (
                        <SelectItem key={f} value={f}>
                          {FORMAT_LABEL[f]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cm-formula">Formül</Label>
              <Input
                id="cm-formula"
                value={formula}
                required
                className="font-mono"
                placeholder="revenue / ordersCount"
                onChange={(e) => setFormula(e.target.value)}
                aria-invalid={formulaError != null}
              />
              {formulaError && (
                <p className="text-xs text-destructive">{formulaError}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {CUSTOM_METRIC_FIELDS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormula((s) => (s ? `${s} ${f}` : f))}
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-accent"
                >
                  {f}
                </button>
              ))}
            </div>
            <Button type="submit" size="sm" disabled={createMut.isPending}>
              {createMut.isPending ? "Ekleniyor…" : "Metrik Ekle"}
            </Button>
          </form>
        ) : (
          <p className="border-t border-border pt-4 text-sm text-muted-foreground">
            Özel metrik eklemek için owner/admin/analyst rolü gerekir.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
