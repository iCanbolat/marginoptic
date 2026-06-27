import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { StarIcon } from "@hugeicons/core-free-icons";
import type { Feature } from "@churnify/shared";
import { useFeature, usePlanLoading } from "@/lib/auth/use-plan";
import { Button } from "@/components/ui/button";

const FEATURE_TITLE: Record<Feature, string> = {
  productProfitability: "Ürün & kampanya kârlılığı",
  campaignProfitability: "Kampanya kârlılığı",
  customMetrics: "Özel metrikler & widget'lar",
  mcp: "AI analizi (MCP)",
};

/**
 * Bir Pro özelliğini plan entitlement'ına göre koşullu render eder.
 * - Erişim varsa: `children`
 * - Erişim yoksa: `fallback` (verilmişse) ya da yükseltme ekranı
 * - Plan henüz yüklenmediyse: hiçbir şey (içerik flash'ını önler)
 */
export function ProFeature({
  feature,
  children,
  fallback,
}: {
  feature: Feature;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const allowed = useFeature(feature);
  const loading = usePlanLoading();
  if (loading) return null;
  if (allowed) return <>{children}</>;
  return <>{fallback ?? <UpgradePrompt feature={feature} />}</>;
}

/** Pro'ya yükseltme çağrısı (kilitli özellik ekranı). */
export function UpgradePrompt({ feature }: { feature: Feature }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <HugeiconsIcon icon={StarIcon} strokeWidth={2} className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{FEATURE_TITLE[feature]} — Pro</h2>
        <p className="text-sm text-muted-foreground">
          Bu özellik Pro plana özeldir. Sınırsız mağaza & kanal, ürün & kampanya
          kârlılığı, özel metrikler ve MCP ile AI analizi için planınızı yükseltin.
        </p>
      </div>
      <Button asChild>
        <Link to="/billing">Pro'ya yükselt</Link>
      </Button>
    </div>
  );
}

/** Pano widget'ı için kompakt kilitli durum (Pro veri yerine yükseltme çağrısı). */
export function LockedWidget({ feature }: { feature: Feature }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 p-4 text-center">
      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
        <HugeiconsIcon icon={StarIcon} strokeWidth={2} className="size-4" />
      </div>
      <p className="text-xs font-medium">{FEATURE_TITLE[feature]}</p>
      <p className="text-[11px] text-muted-foreground">Pro plana özel</p>
      <Button asChild size="sm" variant="outline" className="mt-1 h-7 text-xs">
        <Link to="/billing">Yükselt</Link>
      </Button>
    </div>
  );
}

/** Satır içi küçük "Pro" rozeti (menü öğeleri / başlıklar için). */
export function ProBadge() {
  return (
    <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
      Pro
    </span>
  );
}
