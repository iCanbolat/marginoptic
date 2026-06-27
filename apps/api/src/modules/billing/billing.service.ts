import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import type { Redis } from "ioredis";
import {
  ACTIVE_STATUSES,
  PLANS,
  TRIAL_DAYS,
  withinLimit,
  type BillingState,
  type EffectivePlan,
  type Feature,
  type PlanEntitlement,
  type PlanId,
  type SalesChannel,
  type SubscriptionStatus,
} from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { REDIS } from "../../redis/redis.module";
import { billingEvents, subscriptions } from "../../database/schema/billing";
import { stores } from "../../database/schema/auth";
import { channels } from "../../database/schema/channels";
import { orders } from "../../database/schema/sales";
import { CreemService } from "./creem.service";

type SubRow = typeof subscriptions.$inferSelect;

/** Hesap (kullanıcı) entitlement'ı — plan gating kararları için. */
export interface Entitlement {
  plan: EffectivePlan;
  status: SubscriptionStatus;
  active: boolean;
  storeLimit: number | null;
  channelLimit: number | null;
  ordersPerMonth: number | null;
  lookbackDays: number;
  features: Record<Feature, boolean>;
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
    @Inject(REDIS) private readonly redis: Redis,
    private readonly creem: CreemService,
    private readonly config: ConfigService,
  ) {}

  private async getRow(userId: string): Promise<SubRow | null> {
    const [row] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
    return row ?? null;
  }

  /** Kullanıcının sahip olduğu mağaza (store) sayısı. */
  private async countStores(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(stores)
      .where(eq(stores.ownerUserId, userId));
    return row?.n ?? 0;
  }

  /** Hesabın efektif entitlement'ı (abonelik yoksa `free`). */
  async getEntitlement(userId: string): Promise<Entitlement> {
    const row = await this.getRow(userId);
    const active = Boolean(row && ACTIVE_STATUSES.includes(row.status));
    const plan: EffectivePlan = active && row ? row.plan : "free";
    const def = PLANS[plan];
    return {
      plan,
      status: row?.status ?? "none",
      active,
      storeLimit: def.storeLimit,
      channelLimit: def.channelLimit,
      ordersPerMonth: def.ordersPerMonth,
      lookbackDays: def.lookbackDays,
      features: def.features,
    };
  }

  /** Geriye dönük sorgu için izin verilen gün sayısı (look-back clamp). */
  async lookbackDays(userId: string): Promise<number> {
    const ent = await this.getEntitlement(userId);
    return ent.lookbackDays;
  }

  /** Mağaza (store) sahibinin look-back gün limiti — analitik clamp için. */
  async lookbackDaysForStore(storeId: string): Promise<number> {
    const ent = await this.entitlementForStore(storeId);
    return ent?.lookbackDays ?? PLANS.free.lookbackDays;
  }

  /** `me()` ve frontend gating için entitlement özeti (plan + özellik + limit + kullanım). */
  async entitlementSummary(userId: string): Promise<PlanEntitlement> {
    const state = await this.getState(userId);
    return {
      plan: state.plan,
      features: state.features,
      limits: {
        storeLimit: state.usage.storeLimit,
        channelLimit: state.usage.channelLimit,
        ordersPerMonth: state.usage.ordersPerMonth,
        lookbackDays: state.lookbackDays,
      },
      usage: state.usage,
    };
  }

  /** `GET /billing` — abonelik + kullanım + entitlement. */
  async getState(userId: string): Promise<BillingState> {
    const row = await this.getRow(userId);
    const ent = await this.getEntitlement(userId);
    const storesCount = await this.countStores(userId);
    const channelsCount = await this.countChannelsForUser(userId);
    const ordersThisMonth = await this.monthlyOrderUsage(userId);
    const overLimit =
      ent.ordersPerMonth !== null && ordersThisMonth >= ent.ordersPerMonth;
    return {
      plan: ent.plan,
      status: ent.status,
      active: ent.active,
      trialEndsAt: row?.trialEndsAt?.toISOString() ?? null,
      currentPeriodEnd: row?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: row?.cancelAtPeriodEnd ?? false,
      usage: {
        stores: storesCount,
        storeLimit: ent.storeLimit,
        channels: channelsCount,
        channelLimit: ent.channelLimit,
        ordersThisMonth,
        ordersPerMonth: ent.ordersPerMonth,
        overLimit,
      },
      features: ent.features,
      lookbackDays: ent.lookbackDays,
      manageable: Boolean(row?.creemCustomerId),
    };
  }

  /**
   * Kullanıcı yeni bir mağaza (store) oluşturabilir mi? Plan store limiti
   * aşılıyorsa 403.
   */
  async assertCanAddStore(userId: string): Promise<void> {
    const ent = await this.getEntitlement(userId);
    const count = await this.countStores(userId);
    if (!withinLimit(count, ent.storeLimit)) {
      throw new ForbiddenException(
        `Mağaza limitine ulaşıldı (${count}/${ent.storeLimit}). ` +
          `Daha fazla mağaza eklemek için planınızı yükseltin.`,
      );
    }
  }

  // ---- Kanal limiti ----

  /** Bir mağazadaki bağlı kanal sayısı. */
  private async countChannelsForStore(
    db: DrizzleDB,
    storeId: string,
  ): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(channels)
      .where(eq(channels.storeId, storeId));
    return row?.n ?? 0;
  }

  /** Kullanıcının tüm mağazalarındaki toplam bağlı kanal sayısı. */
  private async countChannelsForUser(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(channels)
      .innerJoin(stores, eq(channels.storeId, stores.id))
      .where(eq(stores.ownerUserId, userId));
    return row?.n ?? 0;
  }

  /** Mağazanın sahibi (owner user id). */
  private async ownerForStore(
    db: DrizzleDB,
    storeId: string,
  ): Promise<string | null> {
    const [row] = await db
      .select({ ownerUserId: stores.ownerUserId })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);
    return row?.ownerUserId ?? null;
  }

  /**
   * Mağazaya yeni bir satış kanalı bağlanabilir mi? Plan kanal limiti aşılırsa 403.
   * Var olan kanal tipinin yeniden bağlanması (reconnect) limit dışıdır.
   * `db` verilirse (transaction) aynı tx üzerinde kontrol eder.
   */
  async assertCanAddChannel(
    storeId: string,
    channel: SalesChannel,
    db: DrizzleDB = this.db,
  ): Promise<void> {
    // Var olan kanal tipi → reconnect; limit kontrolü yapma.
    const [existing] = await db
      .select({ id: channels.id })
      .from(channels)
      .where(and(eq(channels.storeId, storeId), eq(channels.channel, channel)))
      .limit(1);
    if (existing) return;

    const ownerUserId = await this.ownerForStore(db, storeId);
    if (!ownerUserId) return; // sahip çözülemedi → best-effort, engelleme
    const ent = await this.getEntitlement(ownerUserId);
    const count = await this.countChannelsForStore(db, storeId);
    if (!withinLimit(count, ent.channelLimit)) {
      throw new ForbiddenException(
        `Kanal limitine ulaşıldı (${count}/${ent.channelLimit}). ` +
          `Daha fazla satış kanalı bağlamak için planınızı Pro'ya yükseltin.`,
      );
    }
  }

  // ---- MCP entitlement ----

  /** Bir mağazanın (api key sahibinin) entitlement'ı — MCP gating için. */
  async entitlementForStore(storeId: string): Promise<Entitlement | null> {
    const ownerUserId = await this.ownerForStore(this.db, storeId);
    if (!ownerUserId) return null;
    return this.getEntitlement(ownerUserId);
  }

  // ---- Aylık sipariş kullanımı (soft cap) ----

  private currentMonthKey(d: Date = new Date()): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  private orderUsageKey(userId: string, monthKey: string): string {
    return `usage:orders:${userId}:${monthKey}`;
  }

  /** Kanalın sahibini (Redis cache'li) çözer. */
  private async ownerForChannel(channelId: string): Promise<string | null> {
    const cacheKey = `usage:chanowner:${channelId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;
    const [row] = await this.db
      .select({ ownerUserId: stores.ownerUserId })
      .from(channels)
      .innerJoin(stores, eq(channels.storeId, stores.id))
      .where(eq(channels.id, channelId))
      .limit(1);
    const owner = row?.ownerUserId ?? null;
    if (owner) await this.redis.set(cacheKey, owner, "EX", 60 * 60 * 24);
    return owner;
  }

  /** İçinde bulunulan takvim ayında kullanıcının siparişlerini DB'den say (seed). */
  private async dbMonthlyOrderCount(
    userId: string,
    monthKey: string,
  ): Promise<number> {
    const start = new Date(`${monthKey}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .innerJoin(channels, eq(orders.channelId, channels.id))
      .innerJoin(stores, eq(channels.storeId, stores.id))
      .where(
        and(
          eq(stores.ownerUserId, userId),
          gte(orders.processedAt, start),
          lt(orders.processedAt, end),
        ),
      );
    return row?.n ?? 0;
  }

  /** Aylık sipariş sayacını oku; yoksa DB'den seed eder (~40 gün TTL). */
  async monthlyOrderUsage(userId: string): Promise<number> {
    const monthKey = this.currentMonthKey();
    const key = this.orderUsageKey(userId, monthKey);
    const cached = await this.redis.get(key);
    if (cached !== null) return Number(cached) || 0;
    const seeded = await this.dbMonthlyOrderCount(userId, monthKey);
    await this.redis.set(key, String(seeded), "EX", 60 * 60 * 24 * 40);
    return seeded;
  }

  /**
   * Yeni bir sipariş ingest edildiğinde (yalnız insert) aylık sayacı artırır.
   * **Soft cap**: asla engellemez, yalnız sayacı korur; hata olsa bile yutar
   * (kullanım takibi sipariş yazımını bozmamalı). Transaction commit'inden
   * SONRA çağrılmalıdır (sayaç seed'i commit edilen satırı görür).
   */
  async recordOrderIngested(channelId: string): Promise<void> {
    try {
      const userId = await this.ownerForChannel(channelId);
      if (!userId) return;
      const monthKey = this.currentMonthKey();
      const key = this.orderUsageKey(userId, monthKey);
      const exists = await this.redis.exists(key);
      if (exists) {
        await this.redis.incr(key);
      } else {
        // İlk yazım: DB sayımı zaten bu (commit edilmiş) order'ı içerir → INCR'a gerek yok.
        const seeded = await this.dbMonthlyOrderCount(userId, monthKey);
        await this.redis.set(key, String(seeded), "EX", 60 * 60 * 24 * 40);
      }
    } catch (err) {
      this.logger.warn(`Sipariş kullanım sayacı güncellenemedi: ${String(err)}`);
    }
  }

  /** Aylık sipariş limiti aşıldı mı (soft brake için). */
  async isOverOrderLimit(userId: string): Promise<boolean> {
    const ent = await this.getEntitlement(userId);
    if (ent.ordersPerMonth === null) return false;
    const used = await this.monthlyOrderUsage(userId);
    return used >= ent.ordersPerMonth;
  }

  /** Bir kanal sahibinin aylık sipariş limiti aşıldı mı (backfill soft-brake). */
  async isOverOrderLimitForChannel(channelId: string): Promise<boolean> {
    const userId = await this.ownerForChannel(channelId);
    if (!userId) return false;
    return this.isOverOrderLimit(userId);
  }

  /** Hosted checkout başlat (canlı). Dev modda dev-activate kullanılmalı. */
  async createCheckout(userId: string, email: string, plan: PlanId): Promise<string> {
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
      requestId: userId,
      metadata: { userId, plan },
    });
    return checkoutUrl;
  }

  /** Müşteri portalı linki (abonelik/ödeme yönetimi). */
  async createPortal(userId: string): Promise<string> {
    const row = await this.getRow(userId);
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
  async devActivate(userId: string, plan: PlanId): Promise<BillingState> {
    if (this.config.get<string>("NODE_ENV") === "production") {
      throw new ForbiddenException("dev-activate üretimde kullanılamaz.");
    }
    const now = Date.now();
    const trialEnd = new Date(now + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    await this.upsert(userId, {
      plan,
      status: "trialing",
      creemCustomerId: `dev_cust_${userId.slice(0, 8)}`,
      creemSubscriptionId: `dev_sub_${userId.slice(0, 8)}`,
      creemProductId: `dev_prod_${plan}`,
      trialEndsAt: trialEnd,
      currentPeriodEnd: trialEnd,
      cancelAtPeriodEnd: false,
      canceledAt: null,
    });
    return this.getState(userId);
  }

  /** Hesap abonelik satırını upsert eder (kullanıcı-tekil). */
  private async upsert(
    userId: string,
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
      .values({ userId, ...values, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: subscriptions.userId,
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
    const userId = this.resolveUserId(object);

    // Idempotency: aynı event tekrar gelirse atla
    if (eventId) {
      const inserted = await this.db
        .insert(billingEvents)
        .values({ creemEventId: eventId, eventType, userId, payload: envelope })
        .onConflictDoNothing({ target: billingEvents.creemEventId })
        .returning({ id: billingEvents.id });
      if (inserted.length === 0) {
        this.logger.debug(`Webhook ${eventId} zaten işlendi, atlanıyor`);
        return;
      }
    }

    if (!userId) {
      this.logger.warn(`Webhook ${eventType} için kullanıcı çözümlenemedi`);
      return;
    }

    await this.applyEvent(userId, eventType, object);
  }

  /** object.metadata.userId → request_id ile hesabı (kullanıcı) bul. */
  private resolveUserId(object: CreemObject): string | null {
    const sub = object.subscription ?? object;
    const metaUser = object.metadata?.userId ?? sub.metadata?.userId ?? null;
    if (metaUser) return metaUser;
    if (object.request_id) return object.request_id;
    return null;
  }

  private async applyEvent(
    userId: string,
    eventType: string,
    object: CreemObject,
  ): Promise<void> {
    // checkout.completed → object.subscription; subscription.* → object'in kendisi
    const sub = object.subscription ?? object;
    const productId = idOf(sub.product) ?? idOf(object.product);
    const customerId = idOf(sub.customer) ?? idOf(object.customer);
    const plan =
      this.creem.planForProductId(productId) ??
      (await this.getRow(userId))?.plan ??
      "basic";

    let status: SubscriptionStatus;
    if (eventType === "subscription.expired") status = "expired";
    else if (eventType === "subscription.canceled") status = "canceled";
    else if (eventType === "subscription.scheduled_cancel") status = "scheduled_cancel";
    else if (eventType === "subscription.past_due") status = "past_due";
    else status = STATUS_MAP[sub.status ?? ""] ?? "active";

    const periodEnd = parseDate(sub.current_period_end_date ?? sub.current_period_end);
    const canceledAt = parseDate(sub.canceled_at);

    await this.upsert(userId, {
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
    this.logger.log(`Abonelik güncellendi user=${userId} plan=${plan} durum=${status}`);
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
