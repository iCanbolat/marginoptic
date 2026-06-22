import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, ne, sql } from "drizzle-orm";
import {
  ACTIVE_STATUSES,
  PLANS,
  TRIAL_DAYS,
  type BillingState,
  type EffectivePlan,
  type PlanId,
  type SubscriptionStatus,
} from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { billingEvents, subscriptions } from "../../database/schema/billing";
import { stores } from "../../database/schema/stores";
import { CreemService } from "./creem.service";

type SubRow = typeof subscriptions.$inferSelect;

/** Org entitlement — plan gating kararları için. */
export interface Entitlement {
  plan: EffectivePlan;
  status: SubscriptionStatus;
  active: boolean;
  storeLimit: number;
}

/** Creem durum string'i → bizim enum (bilinmeyen → active'e en yakın). */
const STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: "active",
  trialing: "trialing",
  paused: "paused",
  past_due: "past_due",
  expired: "expired",
  canceled: "canceled",
  cancelled: "canceled",
  scheduled_cancel: "scheduled_cancel",
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly creem: CreemService,
    private readonly config: ConfigService,
  ) {}

  private async getRow(orgId: string): Promise<SubRow | null> {
    const [row] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, orgId))
      .limit(1);
    return row ?? null;
  }

  private async countActiveStores(orgId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(stores)
      .where(
        and(eq(stores.organizationId, orgId), ne(stores.status, "disconnected")),
      );
    return row?.n ?? 0;
  }

  /** Org'un efektif entitlement'ı (abonelik yoksa `free`). */
  async getEntitlement(orgId: string): Promise<Entitlement> {
    const row = await this.getRow(orgId);
    if (!row || !ACTIVE_STATUSES.includes(row.status)) {
      return {
        plan: "free",
        status: row?.status ?? "none",
        active: false,
        storeLimit: PLANS.free.storeLimit,
      };
    }
    return {
      plan: row.plan,
      status: row.status,
      active: true,
      storeLimit: PLANS[row.plan].storeLimit,
    };
  }

  /** `GET /billing` — abonelik + kullanım + entitlement. */
  async getState(orgId: string): Promise<BillingState> {
    const row = await this.getRow(orgId);
    const ent = await this.getEntitlement(orgId);
    const storesCount = await this.countActiveStores(orgId);
    return {
      plan: ent.plan,
      status: ent.status,
      active: ent.active,
      trialEndsAt: row?.trialEndsAt?.toISOString() ?? null,
      currentPeriodEnd: row?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: row?.cancelAtPeriodEnd ?? false,
      usage: { stores: storesCount, storeLimit: ent.storeLimit },
      manageable: Boolean(row?.creemCustomerId),
    };
  }

  /**
   * Yeni mağaza bağlanabilir mi? Limit aşılıyorsa 403. Var olan mağazanın
   * yeniden bağlanması (reconnect) limitten muaftır.
   */
  async assertCanAddStore(orgId: string, externalShopId?: string): Promise<void> {
    if (externalShopId) {
      const [existing] = await this.db
        .select({ id: stores.id })
        .from(stores)
        .where(
          and(
            eq(stores.organizationId, orgId),
            eq(stores.externalShopId, externalShopId),
          ),
        )
        .limit(1);
      if (existing) return; // reconnect — limitten muaf
    }
    const ent = await this.getEntitlement(orgId);
    const count = await this.countActiveStores(orgId);
    if (count >= ent.storeLimit) {
      throw new ForbiddenException(
        `Mağaza limitine ulaşıldı (${count}/${ent.storeLimit}). ` +
          `Daha fazla mağaza bağlamak için planınızı yükseltin.`,
      );
    }
  }

  /** Hosted checkout başlat (canlı). Dev modda dev-activate kullanılmalı. */
  async createCheckout(orgId: string, email: string, plan: PlanId): Promise<string> {
    if (!this.creem.isConfigured) {
      throw new BadRequestException(
        "Creem yapılandırılmadı (dev mod). Plan etkinleştirmek için dev-activate kullanın.",
      );
    }
    const productId = this.creem.productIdForPlan(plan);
    if (!productId) {
      throw new BadRequestException(`${plan} planı için Creem ürün kimliği tanımlı değil.`);
    }
    const webOrigin = this.config.get<string>("WEB_ORIGIN", "http://localhost:5173");
    const { checkoutUrl } = await this.creem.createCheckout({
      productId,
      successUrl: `${webOrigin}/billing?billing=success`,
      email,
      requestId: orgId,
      metadata: { organizationId: orgId, plan },
    });
    return checkoutUrl;
  }

  /** Müşteri portalı linki (abonelik/ödeme yönetimi). */
  async createPortal(orgId: string): Promise<string> {
    const row = await this.getRow(orgId);
    if (!row?.creemCustomerId) {
      throw new BadRequestException("Yönetilecek aktif bir abonelik yok.");
    }
    if (!this.creem.isConfigured) {
      throw new BadRequestException("Creem yapılandırılmadı (dev mod).");
    }
    return this.creem.createPortalLink(row.creemCustomerId);
  }

  /**
   * Dev/sentetik plan etkinleştirme (yalnız non-prod, Creem anahtarı yokken).
   * Webhook olmadan 14 günlük denemeyle abonelik kurar (e2e doğrulama için).
   */
  async devActivate(orgId: string, plan: PlanId): Promise<BillingState> {
    if (this.config.get<string>("NODE_ENV") === "production") {
      throw new ForbiddenException("dev-activate üretimde kullanılamaz.");
    }
    const now = Date.now();
    const trialEnd = new Date(now + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    await this.upsert(orgId, {
      plan,
      status: "trialing",
      creemCustomerId: `dev_cust_${orgId.slice(0, 8)}`,
      creemSubscriptionId: `dev_sub_${orgId.slice(0, 8)}`,
      creemProductId: `dev_prod_${plan}`,
      trialEndsAt: trialEnd,
      currentPeriodEnd: trialEnd,
      cancelAtPeriodEnd: false,
      canceledAt: null,
    });
    return this.getState(orgId);
  }

  /** Org abonelik satırını upsert eder (org-tekil). */
  private async upsert(
    orgId: string,
    values: {
      plan: PlanId;
      status: SubscriptionStatus;
      creemCustomerId?: string | null;
      creemSubscriptionId?: string | null;
      creemProductId?: string | null;
      trialEndsAt?: Date | null;
      currentPeriodEnd?: Date | null;
      cancelAtPeriodEnd?: boolean;
      canceledAt?: Date | null;
    },
  ): Promise<void> {
    await this.db
      .insert(subscriptions)
      .values({ organizationId: orgId, ...values, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: subscriptions.organizationId,
        set: { ...values, updatedAt: new Date() },
      });
  }

  // ---- Webhook ----

  /**
   * Creem webhook'unu işler: imza doğrula → idempotent kaydet → aboneliği aynala.
   * `raw` ham gövde (HMAC için), `signature` `creem-signature` başlığı.
   */
  async handleWebhook(
    raw: Buffer | string | undefined,
    signature: string | undefined,
  ): Promise<void> {
    if (!this.creem.verifyWebhookSignature(raw, signature)) {
      throw new ForbiddenException("Geçersiz webhook imzası");
    }
    const text = typeof raw === "string" ? raw : raw?.toString("utf8");
    if (!text) throw new BadRequestException("Boş webhook gövdesi");

    let envelope: CreemWebhookEnvelope;
    try {
      envelope = JSON.parse(text) as CreemWebhookEnvelope;
    } catch {
      throw new BadRequestException("Webhook JSON ayrıştırılamadı");
    }

    const eventId = envelope.id;
    const eventType = envelope.eventType ?? envelope.type ?? "unknown";
    const object = envelope.object ?? {};
    const orgId = this.resolveOrgId(object);

    // Idempotency: aynı event tekrar gelirse atla
    if (eventId) {
      const inserted = await this.db
        .insert(billingEvents)
        .values({ creemEventId: eventId, eventType, organizationId: orgId, payload: envelope })
        .onConflictDoNothing({ target: billingEvents.creemEventId })
        .returning({ id: billingEvents.id });
      if (inserted.length === 0) {
        this.logger.debug(`Webhook ${eventId} zaten işlendi, atlanıyor`);
        return;
      }
    }

    if (!orgId) {
      this.logger.warn(`Webhook ${eventType} için org çözümlenemedi`);
      return;
    }

    await this.applyEvent(orgId, eventType, object);
  }

  /** object.metadata.organizationId → request_id → mevcut satır (creem id) ile org bul. */
  private resolveOrgId(object: CreemObject): string | null {
    const sub = object.subscription ?? object;
    const metaOrg =
      object.metadata?.organizationId ?? sub.metadata?.organizationId ?? null;
    if (metaOrg) return metaOrg;
    if (object.request_id) return object.request_id;
    return null;
  }

  private async applyEvent(
    orgId: string,
    eventType: string,
    object: CreemObject,
  ): Promise<void> {
    // checkout.completed → object.subscription; subscription.* → object'in kendisi
    const sub = object.subscription ?? object;
    const productId = idOf(sub.product) ?? idOf(object.product);
    const customerId = idOf(sub.customer) ?? idOf(object.customer);
    const plan =
      this.creem.planForProductId(productId) ??
      (await this.getRow(orgId))?.plan ??
      "basic";

    let status: SubscriptionStatus;
    if (eventType === "subscription.expired") status = "expired";
    else if (eventType === "subscription.canceled") status = "canceled";
    else if (eventType === "subscription.scheduled_cancel") status = "scheduled_cancel";
    else if (eventType === "subscription.past_due") status = "past_due";
    else status = STATUS_MAP[sub.status ?? ""] ?? "active";

    const periodEnd = parseDate(sub.current_period_end_date ?? sub.current_period_end);
    const canceledAt = parseDate(sub.canceled_at);

    await this.upsert(orgId, {
      plan,
      status,
      creemCustomerId: customerId,
      creemSubscriptionId: idOf(sub) ?? null,
      creemProductId: productId,
      trialEndsAt: parseDate(sub.trial_end ?? sub.trial_end_date),
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: eventType === "subscription.scheduled_cancel" || Boolean(canceledAt && status !== "canceled"),
      canceledAt,
    });
    this.logger.log(`Abonelik güncellendi org=${orgId} plan=${plan} durum=${status}`);
  }
}

// ---- Creem webhook tip yardımcıları ----

interface CreemWebhookEnvelope {
  id?: string;
  eventType?: string;
  type?: string;
  object?: CreemObject;
}

interface CreemRef {
  id?: string;
  email?: string;
  metadata?: Record<string, string>;
  status?: string;
  product?: string | CreemRef;
  customer?: string | CreemRef;
  subscription?: CreemObject;
  current_period_end_date?: string;
  current_period_end?: string;
  trial_end?: string;
  trial_end_date?: string;
  canceled_at?: string;
  request_id?: string;
}
type CreemObject = CreemRef;

/** string | {id} → id string. */
function idOf(v: string | CreemRef | undefined | null): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  return v.id ?? null;
}

function parseDate(v: string | undefined | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
