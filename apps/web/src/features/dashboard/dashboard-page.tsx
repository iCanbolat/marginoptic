import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  PencilEdit02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import type {
  DashboardWidget,
  WidgetConfig,
  WidgetType,
} from "@churnify/shared";
import { dashboardsApi } from "@/lib/api";
import { useFeature } from "@/lib/auth/use-plan";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingChecklist } from "../onboarding/onboarding-checklist";
import { DashboardGrid } from "./grid";
import { DashboardSwitcher } from "./dashboard-switcher";
import { DateRangeControl, type DateRangeValue } from "./date-range-control";
import { StoreFilter } from "./store-filter";
import { AddWidgetMenu } from "./add-widget-menu";
import { WidgetConfigDialog } from "./widget-config-dialog";
import { CustomMetricsDialog } from "./custom-metrics-dialog";
import { WIDGET_DEFAULTS } from "./metric-catalog";
import type { DashFilter } from "./use-analytics";

const newId = () => `w-${Math.random().toString(36).slice(2, 9)}`;
const daysAgoIso = (n: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

/** Kayıtlı layout'tan görsel sıra (üstten alta, soldan sağa). */
function orderWidgets(ws: DashboardWidget[]): DashboardWidget[] {
  return [...ws].sort(
    (a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x,
  );
}

/** Dizi sırasını layout'a yaz (sürükle-bırak sırası kalıcı olsun). */
function normalizeOrder(ws: DashboardWidget[]): DashboardWidget[] {
  return ws.map((w, i) => ({ ...w, layout: { ...w.layout, x: 0, y: i } }));
}

/** Starter pano (ilk kurulumda) — KPI'lar + trend + maliyet + P&L + ürünler. */
function starterWidgets(): DashboardWidget[] {
  return [
    { id: newId(), type: "kpi", config: { metric: "netProfit", compare: true }, layout: { x: 0, y: 0, w: 3, h: 2 } },
    { id: newId(), type: "kpi", config: { metric: "revenue", compare: true }, layout: { x: 3, y: 0, w: 3, h: 2 } },
    { id: newId(), type: "kpi", config: { metric: "adSpend", compare: true }, layout: { x: 6, y: 0, w: 3, h: 2 } },
    { id: newId(), type: "kpi", config: { metric: "margin", compare: true }, layout: { x: 9, y: 0, w: 3, h: 2 } },
    { id: newId(), type: "timeseries", config: { metrics: ["revenue", "netProfit"], visual: "area" }, layout: { x: 0, y: 2, w: 8, h: 4 } },
    { id: newId(), type: "cost_breakdown", config: {}, layout: { x: 8, y: 2, w: 4, h: 4 } },
    { id: newId(), type: "pnl", config: {}, layout: { x: 0, y: 6, w: 5, h: 5 } },
    { id: newId(), type: "products", config: { limit: 8 }, layout: { x: 5, y: 6, w: 7, h: 5 } },
  ];
}

export function DashboardPage() {
  const qc = useQueryClient();
  const canEdit = true;
  const canCustomMetrics = useFeature("customMetrics");

  const [range, setRange] = useState<DateRangeValue>({
    from: daysAgoIso(29),
    to: new Date().toISOString().slice(0, 10),
  });
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DashboardWidget[] | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);

  const globalFilter: DashFilter = useMemo(
    () => ({ from: range.from, to: range.to, storeIds, compare: true }),
    [range, storeIds],
  );

  const listQ = useQuery({ queryKey: ["dashboards"], queryFn: dashboardsApi.list });
  const dashboards = listQ.data ?? [];

  // Aktif pano seçimi: state → varsayılan → ilk.
  useEffect(() => {
    if (dashboards.length === 0) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    if (!activeId || !dashboards.some((d) => d.id === activeId)) {
      setActiveId(
        (dashboards.find((d) => d.isDefault) ?? dashboards[0]).id,
      );
    }
  }, [dashboards, activeId]);

  const detailQ = useQuery({
    queryKey: ["dashboard", activeId],
    queryFn: () => dashboardsApi.get(activeId as string),
    enabled: activeId != null,
  });
  const active = dashboards.find((d) => d.id === activeId);
  const widgets =
    editing && draft ? draft : orderWidgets(detailQ.data?.widgets ?? []);

  const saveMut = useMutation({
    mutationFn: (next: DashboardWidget[]) =>
      dashboardsApi.saveWidgets(activeId as string, { widgets: next }),
    onSuccess: (detail) => {
      qc.setQueryData(["dashboard", activeId], detail);
      void qc.invalidateQueries({ queryKey: ["dashboards"] });
      setEditing(false);
      setDraft(null);
      toast.success("Pano kaydedildi");
    },
    onError: () => toast.error("Kaydedilemedi"),
  });

  const seedMut = useMutation({
    mutationFn: async () => {
      const d = await dashboardsApi.create({ name: "Genel Bakış" });
      return dashboardsApi.saveWidgets(d.id, { widgets: starterWidgets() });
    },
    onSuccess: (detail) => {
      void qc.invalidateQueries({ queryKey: ["dashboards"] });
      qc.setQueryData(["dashboard", detail.id], detail);
      setActiveId(detail.id);
      toast.success("Örnek pano oluşturuldu");
    },
    onError: () => toast.error("Oluşturulamadı"),
  });

  const startEdit = () => {
    setDraft(orderWidgets(detailQ.data?.widgets ?? []));
    setEditing(true);
  };
  const cancelEdit = () => {
    setDraft(null);
    setEditing(false);
  };

  // dnd-kit yeniden sıralama: taslağı yeni diziyle değiştir.
  const onReorder = (next: DashboardWidget[]) => {
    if (!editing) return;
    setDraft(next);
  };

  const addWidget = (type: WidgetType) => {
    const def = WIDGET_DEFAULTS[type];
    const base = draft ?? orderWidgets(detailQ.data?.widgets ?? []);
    const widget: DashboardWidget = {
      id: newId(),
      type,
      config: def.config,
      layout: { x: 0, y: base.length, w: def.w, h: def.h },
    };
    setDraft([...base, widget]);
    if (!editing) setEditing(true);
  };

  const removeWidget = (id: string) =>
    setDraft((prev) => (prev ?? []).filter((w) => w.id !== id));

  const saveConfig = (
    id: string,
    config: WidgetConfig,
    size: { w: number; h: number },
  ) =>
    setDraft((prev) =>
      (prev ?? []).map((w) =>
        w.id === id
          ? { ...w, config, layout: { ...w.layout, w: size.w, h: size.h } }
          : w,
      ),
    );

  const configWidget = (draft ?? widgets).find((w) => w.id === configId) ?? null;

  return (
    <div className="space-y-4">
      <OnboardingChecklist />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {dashboards.length > 0 && (
            <DashboardSwitcher
              dashboards={dashboards}
              activeId={activeId}
              active={active}
              canEdit={canEdit}
              onSelect={(id) => {
                cancelEdit();
                setActiveId(id);
              }}
            />
          )}
          <DateRangeControl value={range} onChange={setRange} />
          <StoreFilter value={storeIds} onChange={setStoreIds} />
        </div>
        <div className="flex items-center gap-2">
          {canCustomMetrics && <CustomMetricsDialog canEdit={canEdit} />}
          {canEdit && dashboards.length > 0 && (
            editing ? (
              <div
                key="edit-bar"
                className="flex items-center gap-1.5 border border-border bg-muted/40 p-1 pl-2.5 shadow-sm animate-in fade-in slide-in-from-right-3 zoom-in-95 duration-200 ease-out"
              >
                <span className="flex items-center gap-1.5 pr-0.5 text-xs font-medium text-muted-foreground">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
                  </span>
                  Düzenleme modu
                </span>
                <Separator orientation="vertical" className="h-5" />
                <AddWidgetMenu onAdd={addWidget} />
                <Separator orientation="vertical" className="h-5" />
                <Button variant="ghost" size="sm" onClick={cancelEdit}>
                  İptal
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={saveMut.isPending}
                  onClick={() => saveMut.mutate(normalizeOrder(draft ?? []))}
                >
                  <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-3.5" />
                  {saveMut.isPending ? "Kaydediliyor…" : "Kaydet"}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={startEdit}
                className="gap-1.5 animate-in fade-in duration-200"
              >
                <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="size-3.5" />
                Panoyu düzenle
              </Button>
            )
          )}
        </div>
      </div>

      {listQ.isLoading || (activeId && detailQ.isLoading && !detailQ.data) ? (
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : dashboards.length === 0 ? (
        <EmptyDashboards
          canEdit={canEdit}
          onSeed={() => seedMut.mutate()}
          seeding={seedMut.isPending}
        />
      ) : widgets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Bu panoda henüz widget yok.
            </p>
            {canEdit && <AddWidgetMenu onAdd={addWidget} />}
          </CardContent>
        </Card>
      ) : (
        <DashboardGrid
          widgets={widgets}
          globalFilter={globalFilter}
          editing={editing}
          onReorder={onReorder}
          onConfigure={setConfigId}
          onRemove={removeWidget}
        />
      )}

      <WidgetConfigDialog
        widget={configWidget}
        open={configId != null}
        onOpenChange={(o) => !o && setConfigId(null)}
        onSave={saveConfig}
      />
    </div>
  );
}

function EmptyDashboards({
  canEdit,
  onSeed,
  seeding,
}: {
  canEdit: boolean;
  onSeed: () => void;
  seeding: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="grid size-12 place-items-center rounded-xl bg-muted">
          <HugeiconsIcon
            icon={DashboardSquare01Icon}
            strokeWidth={2}
            className="size-6 text-muted-foreground"
          />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Özelleştirilebilir Pano</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Net kâr, ciro, reklam ve maliyet widget'larını sürükle-bırak ile
            düzenle. Başlamak için örnek bir pano oluştur.
          </p>
        </div>
        {canEdit ? (
          <Button onClick={onSeed} disabled={seeding}>
            {seeding ? "Oluşturuluyor…" : "Örnek pano oluştur"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Pano oluşturmak için bir yönetici gerekiyor.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
