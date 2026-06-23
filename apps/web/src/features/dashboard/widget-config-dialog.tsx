import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DashboardWidget, WidgetConfig, WidgetVisual } from "@churnify/shared";
import { customMetricsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  METRIC_CATALOG,
  WIDGET_LABEL,
} from "./metric-catalog";

const SERIES_METRICS = METRIC_CATALOG.filter(
  (m) => m.kind === "currency" || m.kind === "number",
);
const VISUALS: { value: WidgetVisual; label: string }[] = [
  { value: "area", label: "Alan" },
  { value: "line", label: "Çizgi" },
  { value: "bar", label: "Sütun" },
];

export function WidgetConfigDialog({
  widget,
  open,
  onOpenChange,
  onSave,
}: {
  widget: DashboardWidget | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (
    id: string,
    config: WidgetConfig,
    size: { w: number; h: number },
  ) => void;
}) {
  const [cfg, setCfg] = useState<WidgetConfig>({});
  const [size, setSize] = useState({ w: 4, h: 4 });

  useEffect(() => {
    if (widget) {
      setCfg(widget.config ?? {});
      setSize({ w: widget.layout.w, h: widget.layout.h });
    }
  }, [widget]);

  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, Number.isFinite(v) ? v : min));

  const { data: customMetrics = [] } = useQuery({
    queryKey: ["custom-metrics"],
    queryFn: customMetricsApi.list,
    enabled: open && widget?.type === "custom_metric",
  });

  if (!widget) return null;
  const set = (patch: Partial<WidgetConfig>) =>
    setCfg((c) => ({ ...c, ...patch }));

  const toggleSeries = (key: string) => {
    const cur = cfg.metrics ?? [];
    set({
      metrics: cur.includes(key)
        ? cur.filter((m) => m !== key)
        : [...cur, key],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{WIDGET_LABEL[widget.type]} — Yapılandır</DialogTitle>
          <DialogDescription>
            Widget başlığını, metrik ve görsel seçimini düzenle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* KPI başlığı metrik adından gelir; diğer widget'larda özel başlık opsiyonel. */}
          {widget.type !== "kpi" && (
            <div className="space-y-1.5">
              <Label htmlFor="w-title">Başlık (opsiyonel)</Label>
              <Input
                id="w-title"
                value={cfg.title ?? ""}
                placeholder={WIDGET_LABEL[widget.type]}
                onChange={(e) => set({ title: e.target.value })}
              />
            </div>
          )}

          {widget.type === "kpi" && (
            <>
              <Field label="Metrik">
                <Select
                  value={cfg.metric ?? "netProfit"}
                  onValueChange={(metric) => set({ metric })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METRIC_CATALOG.map((m) => (
                      <SelectItem key={m.key} value={m.key}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Toggle
                label="Önceki dönemle karşılaştır"
                checked={cfg.compare ?? false}
                onChange={(compare) => set({ compare })}
              />
            </>
          )}

          {widget.type === "timeseries" && (
            <>
              <Field label="Seriler">
                <div className="grid grid-cols-2 gap-1.5">
                  {SERIES_METRICS.map((m) => {
                    const checked = (cfg.metrics ?? []).includes(m.key);
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => toggleSeries(m.key)}
                        className={cn(
                          "rounded-md border px-2 py-1.5 text-left text-xs",
                          checked
                            ? "border-primary bg-primary/10 font-medium"
                            : "border-border hover:bg-accent",
                        )}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Görsel">
                <Select
                  value={cfg.visual ?? "area"}
                  onValueChange={(v) => set({ visual: v as WidgetVisual })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VISUALS.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}

          {widget.type === "products" && (
            <Field label="Satır sayısı">
              <Input
                type="number"
                min={1}
                max={50}
                value={cfg.limit ?? 8}
                onChange={(e) =>
                  set({ limit: Math.max(1, Math.min(50, Number(e.target.value) || 8)) })
                }
              />
            </Field>
          )}

          {widget.type === "custom_metric" && (
            <Field label="Özel metrik">
              {customMetrics.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Henüz özel metrik yok. Önce "Özel Metrikler"den oluştur.
                </p>
              ) : (
                <Select
                  value={cfg.customMetricId ?? ""}
                  onValueChange={(customMetricId) => set({ customMetricId })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seç…" />
                  </SelectTrigger>
                  <SelectContent>
                    {customMetrics.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
            <Field label="Genişlik (1–12 kolon)">
              <Input
                type="number"
                min={1}
                max={12}
                value={size.w}
                onChange={(e) =>
                  setSize((s) => ({ ...s, w: clamp(Number(e.target.value), 1, 12) }))
                }
              />
            </Field>
            <Field label="Yükseklik (1–24 satır)">
              <Input
                type="number"
                min={1}
                max={24}
                value={size.h}
                onChange={(e) =>
                  setSize((s) => ({ ...s, h: clamp(Number(e.target.value), 1, 24) }))
                }
              />
            </Field>
          </div>

          <DateOverrideField cfg={cfg} set={set} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button
            onClick={() => {
              onSave(widget.id, cfg, size);
              onOpenChange(false);
            }}
          >
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DateOverrideField({
  cfg,
  set,
}: {
  cfg: WidgetConfig;
  set: (patch: Partial<WidgetConfig>) => void;
}) {
  const on = cfg.dateOverride != null;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <Toggle
        label="Kendi tarih aralığını kullan"
        checked={on}
        onChange={(v) =>
          set({ dateOverride: v ? { from: today, to: today } : null })
        }
      />
      {on && cfg.dateOverride && (
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            value={cfg.dateOverride.from}
            onChange={(e) =>
              set({
                dateOverride: { ...cfg.dateOverride!, from: e.target.value },
              })
            }
          />
          <Input
            type="date"
            value={cfg.dateOverride.to}
            onChange={(e) =>
              set({
                dateOverride: { ...cfg.dateOverride!, to: e.target.value },
              })
            }
          />
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="font-normal">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
