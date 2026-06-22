import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { costsApi, dashboardsApi, storesApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DISMISS_KEY = "churnify:onboarding-dismissed";

interface Step {
  id: string;
  title: string;
  description: string;
  done: boolean;
  to?: "/integrations" | "/costs";
  cta: string;
}

/**
 * Faz 9 — İlk kullanıcı onboarding kontrol listesi. Pano üstünde, kurulum
 * tamamlanmadıkça gösterilir: mağaza bağla → maliyet gir → pano oluştur.
 * Tüm adımlar bitince veya kullanıcı kapatınca gizlenir (localStorage).
 */
export function OnboardingChecklist() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === "1",
  );

  const storesQ = useQuery({ queryKey: ["stores"], queryFn: storesApi.list });
  const dashboardsQ = useQuery({
    queryKey: ["dashboards"],
    queryFn: dashboardsApi.list,
  });
  const stores = storesQ.data ?? [];
  const firstStore = stores[0];

  const cogsQ = useQuery({
    queryKey: ["cogs", firstStore?.id],
    queryFn: () => costsApi.listCogs(firstStore!.id),
    enabled: firstStore != null,
  });

  // Veri henüz yüklenmediyse erken çıkma (yanıp sönmeyi önler).
  if (storesQ.isLoading || dashboardsQ.isLoading) return null;

  const steps: Step[] = [
    {
      id: "store",
      title: "İlk mağazanı bağla",
      description: "Shopify veya Etsy mağazanı bağlayarak siparişleri içe aktar.",
      done: stores.length > 0,
      to: "/integrations",
      cta: "Mağaza bağla",
    },
    {
      id: "cogs",
      title: "Maliyetleri (COGS) gir",
      description: "Ürün maliyetlerini ekle ki net kâr doğru hesaplansın.",
      done: (cogsQ.data?.length ?? 0) > 0,
      to: "/costs",
      cta: "Maliyet ekle",
    },
    {
      id: "dashboard",
      title: "Net kâr panonu oluştur",
      description: "Örnek panoyla KPI, trend ve kârlılık widget'larını gör.",
      done: (dashboardsQ.data?.length ?? 0) > 0,
      cta: "Panoya geç",
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const allDone = completed === steps.length;

  // Hepsi tamamsa ya da kullanıcı kapattıysa gösterme.
  if (allDone || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <Card aria-label="Başlangıç kontrol listesi">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Churnify'a hoş geldin 👋</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Net kâr panonu görmek için {steps.length} adım — {completed}/
            {steps.length} tamamlandı.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={dismiss}
          aria-label="Kontrol listesini kapat"
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* İlerleme çubuğu */}
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={completed}
          aria-valuemin={0}
          aria-valuemax={steps.length}
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(completed / steps.length) * 100}%` }}
          />
        </div>

        <ol className="divide-y divide-border">
          {steps.map((step) => (
            <li
              key={step.id}
              className="flex items-center gap-3 py-3"
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                  step.done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input text-muted-foreground",
                )}
                aria-hidden="true"
              >
                {step.done ? (
                  <HugeiconsIcon icon={Tick02Icon} strokeWidth={2.5} className="size-3.5" />
                ) : (
                  steps.indexOf(step) + 1
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.done && "text-muted-foreground line-through",
                  )}
                >
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              {!step.done && step.to ? (
                <Button asChild size="sm" variant="outline">
                  <Link to={step.to}>{step.cta}</Link>
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
