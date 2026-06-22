import { z } from "zod";

/**
 * Faz 9 — Faturalandırma (billing) sözleşmesi (API ⇄ web ortak).
 *
 * Sağlayıcı: **creem.io** (Merchant of Record). Stripe kullanılmaz.
 * İki abonelik planı (`basic`, `pro`); her plan **14 günlük ücretsiz deneme** içerir.
 * Gerçek fiyat/ürün Creem panosunda tanımlı (env `CREEM_PRODUCT_BASIC`/`CREEM_PRODUCT_PRO`);
 * burada yalnız UI gösterimi + uygulama tarafı limitleri (entitlement) tutulur.
 */

/** Ücretsiz deneme süresi (gün) — Creem ürününde de aynı ayarlanmalı. */
export const TRIAL_DAYS = 14;

/** Seçilebilir abonelik planları. `free` satın alınamaz; abonelik yoksa varsayılan durumdur. */
export const PLAN_IDS = ["basic", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Efektif plan — abonelik yoksa `free` (gating için en dar entitlement). */
export type EffectivePlan = PlanId | "free";

/** Creem abonelik durumları (+ abonelik yoksa `none`). */
export const SUBSCRIPTION_STATUSES = [
  "none",
  "trialing",
  "active",
  "past_due",
  "paused",
  "scheduled_cancel",
  "canceled",
  "expired",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Bir abonelik durumunun erişim hakkı verip vermediği (trialing dahil). */
export const ACTIVE_STATUSES: SubscriptionStatus[] = [
  "trialing",
  "active",
  "scheduled_cancel",
];

export interface PlanDefinition {
  id: EffectivePlan;
  name: string;
  /** UI'da gösterilen fiyat etiketi (gerçek tahsilat Creem'de). */
  priceLabel: string;
  /** Aylık fiyat (USD, gösterim için). */
  monthlyPrice: number;
  /** Bağlanabilecek azami mağaza sayısı. */
  storeLimit: number;
  /** Özellik satırları (UI). */
  features: string[];
}

/**
 * Plan tanımları (entitlement kaynağı). `free`: abonelik olmadan keşif için 1 mağaza;
 * `basic`/`pro` satın alınabilir ve **14 günlük denemeyle** başlar.
 */
export const PLANS: Record<EffectivePlan, PlanDefinition> = {
  free: {
    id: "free",
    name: "Ücretsiz",
    priceLabel: "$0",
    monthlyPrice: 0,
    storeLimit: 1,
    features: [
      "1 mağaza bağlayın",
      "Net kâr panosu",
      "Maliyet & gider yönetimi",
    ],
  },
  basic: {
    id: "basic",
    name: "Basic",
    priceLabel: "$19/ay",
    monthlyPrice: 19,
    storeLimit: 3,
    features: [
      "3 mağazaya kadar",
      "Reklam entegrasyonları (Meta/Google/TikTok)",
      "Özelleştirilebilir pano & widget'lar",
      "14 gün ücretsiz deneme",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceLabel: "$49/ay",
    monthlyPrice: 49,
    storeLimit: 25,
    features: [
      "25 mağazaya kadar",
      "Custom metrics & MCP (AI) erişimi",
      "Müşteri analitiği (LTV/CAC/kohort)",
      "Öncelikli destek",
      "14 gün ücretsiz deneme",
    ],
  },
};

/** Satın alınabilir planlar (UI plan kartları); `id` daraltılmış (`basic`/`pro`). */
export const PURCHASABLE_PLANS: (PlanDefinition & { id: PlanId })[] = PLAN_IDS.map(
  (id) => ({ ...PLANS[id], id }),
);

/** Checkout başlatma girdisi. */
export const billingCheckoutSchema = z.object({
  plan: z.enum(PLAN_IDS),
});
export type BillingCheckoutInput = z.infer<typeof billingCheckoutSchema>;

/** Dev/sentetik etkinleştirme (yalnız Creem anahtarı yokken; non-prod). */
export const billingDevActivateSchema = z.object({
  plan: z.enum(PLAN_IDS),
});
export type BillingDevActivateInput = z.infer<typeof billingDevActivateSchema>;

/** Hosted checkout / portal yanıtı: tarayıcı bu URL'e yönlendirilir. */
export interface BillingRedirectResponse {
  url: string;
}

/** Org'un mağaza kullanımı + limiti (gating UI). */
export interface BillingUsage {
  stores: number;
  storeLimit: number;
}

/** Org abonelik & entitlement durumu (`GET /billing`). */
export interface BillingState {
  /** Efektif plan (abonelik yoksa `free`). */
  plan: EffectivePlan;
  status: SubscriptionStatus;
  /** Erişim hakkı veren bir durumda mı (trialing/active/scheduled_cancel). */
  active: boolean;
  /** Deneme dönemindeyse bitiş ISO tarihi; değilse null. */
  trialEndsAt: string | null;
  /** Mevcut fatura döneminin bitişi (ISO); yoksa null. */
  currentPeriodEnd: string | null;
  /** Dönem sonunda iptal edilecek mi (scheduled_cancel). */
  cancelAtPeriodEnd: boolean;
  usage: BillingUsage;
  /** Creem müşteri portalı kullanılabilir mi (abonelik var mı). */
  manageable: boolean;
}
