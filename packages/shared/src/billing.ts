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

/** Pro'ya özel özellik bayrakları (gating anahtarları). */
export const PRO_FEATURES = [
  "productProfitability",
  "campaignProfitability",
  "customMetrics",
  "mcp",
] as const;
export type Feature = (typeof PRO_FEATURES)[number];

/** Plan kullanım limitleri; `null` = sınırsız (Infinity yerine JSON-güvenli). */
export interface PlanLimits {
  /** Bağlanabilecek azami mağaza sayısı (null = sınırsız). */
  storeLimit: number | null;
  /** Mağaza başına azami satış kanalı (null = sınırsız). */
  channelLimit: number | null;
  /** Aylık (takvim ayı) azami sipariş — tüm mağaza/kanallar toplamı (null = sınırsız). */
  ordersPerMonth: number | null;
  /** Geriye dönük sorgulanabilecek azami gün sayısı. */
  lookbackDays: number;
}

export interface PlanDefinition extends PlanLimits {
  id: EffectivePlan;
  name: string;
  /** UI'da gösterilen fiyat etiketi (gerçek tahsilat Creem'de). */
  priceLabel: string;
  /** Aylık fiyat (USD, gösterim için). */
  monthlyPrice: number;
  /** Pro özellik erişim haritası (gating). */
  features: Record<Feature, boolean>;
  /** Özellik satırları (yalnız UI bülteni). */
  featureLabels: string[];
}

/** `true` = sınırsız limit. */
export function isUnlimited(limit: number | null): boolean {
  return limit === null;
}

/** `count` verilen limit içinde mi (yeni bir öğe eklemeye yer var mı). */
export function withinLimit(count: number, limit: number | null): boolean {
  return limit === null || count < limit;
}

/** Planın bir Pro özelliğine erişimi var mı. */
export function planAllows(plan: EffectivePlan, feature: Feature): boolean {
  return PLANS[plan].features[feature] === true;
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
    channelLimit: 1,
    ordersPerMonth: 0,
    lookbackDays: 365,
    features: {
      productProfitability: false,
      campaignProfitability: false,
      customMetrics: false,
      mcp: false,
    },
    featureLabels: [
      "1 mağaza bağlayın",
      "Net kâr panosu",
      "Maliyet & gider yönetimi",
    ],
  },
  basic: {
    id: "basic",
    name: "Basic",
    priceLabel: "$39/ay",
    monthlyPrice: 39,
    storeLimit: 1,
    channelLimit: 2,
    ordersPerMonth: 50,
    lookbackDays: 365,
    features: {
      productProfitability: false,
      campaignProfitability: false,
      customMetrics: false,
      mcp: false,
    },
    featureLabels: [
      "1 mağaza, 2 satış kanalına kadar",
      "Gerçek net kâr panosu",
      "COGS, kargo & komisyon takibi",
      "Reklam atıfı (Meta, Google, TikTok)",
      "1 yıl geçmiş veri",
      "E-posta desteği",
      "Aylık 50 sipariş",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceLabel: "$89/ay",
    monthlyPrice: 89,
    storeLimit: null,
    channelLimit: null,
    ordersPerMonth: 3000,
    lookbackDays: 730,
    features: {
      productProfitability: true,
      campaignProfitability: true,
      customMetrics: true,
      mcp: true,
    },
    featureLabels: [
      "Sınırsız mağaza & kanal", 
      "Ürün & kampanya kârlılığı",
      "Özel metrikler & widget'lar",
      "MCP ile AI analizi",
      "2 yıl geçmiş veri",
      "Öncelikli destek",
      "Aylık 3000 sipariş",
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

/** Org'un kullanım & limit göstergeleri (gating UI). */
export interface BillingUsage {
  stores: number;
  storeLimit: number | null;
  /** Tüm mağazalardaki bağlı kanal sayısı. */
  channels: number;
  channelLimit: number | null;
  /** İçinde bulunulan takvim ayında işlenen sipariş sayısı (tüm mağaza/kanallar). */
  ordersThisMonth: number;
  ordersPerMonth: number | null;
  /** Aylık sipariş limiti aşıldı mı (soft cap; veri düşmez). */
  overLimit: boolean;
}

/** Plan entitlement özeti — `me()` ve billing yanıtlarında paylaşılır. */
export interface PlanEntitlement {
  plan: EffectivePlan;
  features: Record<Feature, boolean>;
  limits: PlanLimits;
  usage: BillingUsage;
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
  /** Pro özellik erişim haritası (gating). */
  features: Record<Feature, boolean>;
  /** Geriye dönük gün limiti. */
  lookbackDays: number;
  /** Creem müşteri portalı kullanılabilir mi (abonelik var mı). */
  manageable: boolean;
}
