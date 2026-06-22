import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import {
  PLANS,
  PURCHASABLE_PLANS,
  type BillingState,
  type PlanId,
  type SubscriptionStatus,
} from "@churnify/shared";
import { ApiError, billingApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth/store";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const IS_DEV = import.meta.env.DEV;

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  none: "Abonelik yok",
  trialing: "Deneme",
  active: "Aktif",
  past_due: "Ödeme gerekli",
  paused: "Duraklatıldı",
  scheduled_cancel: "İptal planlandı",
  canceled: "İptal edildi",
  expired: "Süresi doldu",
};

function statusVariant(
  status: SubscriptionStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active" || status === "trialing") return "default";
  if (status === "past_due" || status === "expired") return "destructive";
  if (status === "none") return "outline";
  return "secondary";
}

/** Deneme bitişine kalan tam gün (negatifse 0). */
function trialDaysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

export function BillingPage() {
  const qc = useQueryClient();
  const activeOrg = useAuthStore((s) => s.activeOrg);
  const canManage = activeOrg?.role === "owner" || activeOrg?.role === "admin";

  const stateQ = useQuery({ queryKey: ["billing"], queryFn: billingApi.state });

  // Creem checkout dönüşü → bildir + tazele + URL'i temizle.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billing = params.get("billing");
    if (!billing) return;
    if (billing === "success") {
      toast.success("Ödeme alındı — aboneliğiniz güncelleniyor.");
      void qc.invalidateQueries({ queryKey: ["billing"] });
    }
    params.delete("billing");
    params.delete("plan");
    const qs = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (qs ? `?${qs}` : ""),
    );
  }, [qc]);

  const checkoutMut = useMutation({
    mutationFn: (plan: PlanId) => billingApi.checkout(plan),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Checkout başlatılamadı"),
  });

  const portalMut = useMutation({
    mutationFn: () => billingApi.portal(),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Portal açılamadı"),
  });

  const devActivateMut = useMutation({
    mutationFn: (plan: PlanId) => billingApi.devActivate(plan),
    onSuccess: () => {
      toast.success("Plan etkinleştirildi (dev)");
      void qc.invalidateQueries({ queryKey: ["billing"] });
      void qc.invalidateQueries({ queryKey: ["stores"] });
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Etkinleştirilemedi"),
  });

  const busy =
    checkoutMut.isPending || portalMut.isPending || devActivateMut.isPending;

  const selectPlan = (plan: PlanId) => {
    if (IS_DEV) devActivateMut.mutate(plan);
    else checkoutMut.mutate(plan);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Faturalandırma</h1>
        <p className="text-sm text-muted-foreground">
          {activeOrg?.name} için abonelik planı. Her plan{" "}
          <strong>14 gün ücretsiz deneme</strong> içerir.
        </p>
      </div>

      {stateQ.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : stateQ.data ? (
        <CurrentPlanCard
          state={stateQ.data}
          canManage={canManage}
          managePending={portalMut.isPending}
          onManage={() => portalMut.mutate()}
        />
      ) : null}

      {/* Plan kartları */}
      <div className="grid gap-4 sm:grid-cols-2">
        {PURCHASABLE_PLANS.map((plan) => {
          const isCurrent =
            stateQ.data?.plan === plan.id && stateQ.data?.active;
          return (
            <Card
              key={plan.id}
              className={cn(
                isCurrent && "border-primary/50 ring-1 ring-primary/20",
              )}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {isCurrent && <Badge>Mevcut plan</Badge>}
                </div>
                <CardDescription>
                  <span className="text-2xl font-semibold text-foreground">
                    {plan.priceLabel}
                  </span>{" "}
                  · {plan.storeLimit} mağazaya kadar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <HugeiconsIcon
                        icon={Tick02Icon}
                        strokeWidth={2.5}
                        className="mt-0.5 size-4 shrink-0 text-primary"
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {canManage ? (
                  <Button
                    className="w-full"
                    size="lg"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={busy || isCurrent}
                    onClick={() => selectPlan(plan.id)}
                  >
                    {isCurrent
                      ? "Mevcut planınız"
                      : IS_DEV
                        ? "Dev etkinleştir"
                        : "Planı seç"}
                  </Button>
                ) : (
                  <p className="text-center text-xs text-muted-foreground">
                    Plan değiştirmek için owner/admin rolü gerekir.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {IS_DEV && (
        <p className="text-center text-xs text-muted-foreground">
          Dev modda Creem anahtarı tanımlı değil — planlar gerçek tahsilat
          olmadan simüle edilir.
        </p>
      )}
    </div>
  );
}

function CurrentPlanCard({
  state,
  canManage,
  managePending,
  onManage,
}: {
  state: BillingState;
  canManage: boolean;
  managePending: boolean;
  onManage: () => void;
}) {
  const plan = PLANS[state.plan];
  const daysLeft =
    state.status === "trialing" ? trialDaysLeft(state.trialEndsAt) : null;
  const { stores, storeLimit } = state.usage;
  const atLimit = stores >= storeLimit;
  const usagePct = Math.min(100, Math.round((stores / storeLimit) * 100));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Mevcut plan: {plan.name}</CardTitle>
            <Badge variant={statusVariant(state.status)}>
              {STATUS_LABEL[state.status]}
            </Badge>
          </div>
          {canManage && state.manageable && (
            <Button
              variant="outline"
              size="sm"
              disabled={managePending}
              onClick={onManage}
            >
              Faturalandırmayı yönet
            </Button>
          )}
        </div>
        <CardDescription>
          {daysLeft != null
            ? `Ücretsiz deneme: ${daysLeft} gün kaldı`
            : state.currentPeriodEnd
              ? `Yenileme: ${formatDate(state.currentPeriodEnd)}`
              : "Aktif aboneliğiniz yok — keşfetmek için ücretsiz plan."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {state.cancelAtPeriodEnd && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <HugeiconsIcon
              icon={Alert02Icon}
              strokeWidth={2}
              className="mt-0.5 size-4 shrink-0"
            />
            <span>
              Aboneliğiniz dönem sonunda
              {state.currentPeriodEnd
                ? ` (${formatDate(state.currentPeriodEnd)})`
                : ""}{" "}
              iptal edilecek.
            </span>
          </div>
        )}

        {/* Mağaza kullanımı */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Mağaza kullanımı</span>
            <span className="font-medium">
              {stores} / {storeLimit}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                atLimit ? "bg-amber-500" : "bg-primary",
              )}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          {atLimit && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Mağaza limitine ulaştınız. Daha fazla mağaza bağlamak için planınızı
              yükseltin.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
