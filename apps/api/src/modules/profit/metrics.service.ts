import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Queue } from "bullmq";
import { and, asc, between, desc, eq, inArray, sql } from "drizzle-orm";
import type { Redis } from "ioredis";
import type {
  DailyStoreMetric,
  MetricsTotals,
  ProductProfitRow,
  StoreMetricsSummary,
} from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { adSpend } from "../../database/schema/ads";
import { expenseAllocations } from "../../database/schema/costs";
import {
  dailyStoreMetrics,
  productProfitDaily,
} from "../../database/schema/metrics";
import {
  productAdLinks,
  productAdSpendDaily,
} from "../../database/schema/product-analytics";
import { channels } from "../../database/schema/channels";
import { REDIS } from "../../redis/redis.module";
import { assertStoreInOrg } from "../costs/store-access";
import { ContributionService, type DateRange } from "./contribution.service";
import {
  dailyNetProfit,
  emptyDaily,
  profitMargin,
  round4,
  type DailyMetricsAccumulator,
} from "./contribution";
import { QUEUE_METRICS_ROLLUP, type MetricsRollupJob } from "./profit.constants";

const f4 = (n: number): string => round4(n).toFixed(4);
const num = (v: string | null | undefined): number => Number(v ?? 0);
const CACHE_TTL_SECONDS = 300;

interface ProductAccumulator {
  date: string;
  productExternalId: string;
  title: string | null;
  units: number;
  revenue: number;
  cogs: number;
  attributedAdSpend: number;
  net: number;
}

/**
 * Faz 5 — Gün+mağaza rollup'ı yazar/okur.
 * `metrics-rollup` kuyruğu `rollupStore`'u çağırır; sipariş katkıları + dağıtılmış
 * özel giderler `daily_store_metrics` ve `product_profit_daily`'ye idempotent yazılır.
 * Okumalar Redis'te `metrics:{store}:{from}:{to}` anahtarıyla cache'lenir; rollup
 * yazınca mağazanın anahtarları invalidate edilir.
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly contributions: ContributionService,
    @InjectQueue(QUEUE_METRICS_ROLLUP)
    private readonly queue: Queue<MetricsRollupJob>,
  ) {}

  // ---- yazma (rollup) ----

  /**
   * Bir mağazanın metriklerini yeniden hesaplar.
   * `range` verilmezse tam (mağazanın tüm tarihleri), verilirse yalnız o aralık.
   */
  async rollupStore(channelId: string, range?: DateRange): Promise<number> {
    const [store] = await this.db
      .select({
        currency: channels.currency,
        storeId: channels.storeId,
      })
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);
    if (!store) return 0;
    const currency = store.currency;

    const contributions = await this.contributions.computeStoreContributions(
      channelId,
      currency,
      range,
    );

    // Gün toplayıcıları (siparişlerden).
    const daily = new Map<string, DailyMetricsAccumulator>();
    const bucket = (date: string): DailyMetricsAccumulator => {
      let b = daily.get(date);
      if (!b) {
        b = emptyDaily();
        daily.set(date, b);
      }
      return b;
    };
    const products = new Map<string, ProductAccumulator>();

    for (const o of contributions) {
      const b = bucket(o.date);
      b.revenue += o.grossSales;
      b.discounts += o.discounts;
      b.refunds += o.refunds;
      b.cogs += o.cogs;
      b.shippingCost += o.shippingCost;
      b.paymentFees += o.paymentFees;
      b.taxes += o.taxBorne;
      b.ordersCount += 1;
      b.units += o.units;

      for (const li of o.lines) {
        const pid = li.productExternalId ?? "unknown";
        const key = `${o.date}|${pid}`;
        let p = products.get(key);
        if (!p) {
          p = {
            date: o.date,
            productExternalId: pid,
            title: li.title,
            units: 0,
            revenue: 0,
            cogs: 0,
            attributedAdSpend: 0,
            net: 0,
          };
          products.set(key, p);
        }
        p.units += li.units;
        p.revenue += li.revenue;
        p.cogs += li.cogs;
        p.net += li.net;
        if (!p.title && li.title) p.title = li.title;
      }
    }

    // Dağıtılmış özel giderler (sipariş olmayan günlerde de gün oluşturur).
    const allocConds = [eq(expenseAllocations.channelId, channelId)];
    if (range) {
      allocConds.push(between(expenseAllocations.date, range.from, range.to));
    }
    const allocRows = await this.db
      .select({
        date: expenseAllocations.date,
        amount: expenseAllocations.amount,
      })
      .from(expenseAllocations)
      .where(and(...allocConds));
    for (const a of allocRows) {
      bucket(a.date).customExpenses += num(a.amount);
    }

    // Reklam harcaması (blended): campaign seviyesi gün toplamı → gün+mağaza ad_spend.
    const adConds = [
      eq(adSpend.channelId, channelId),
      eq(adSpend.level, "campaign"),
    ];
    if (range) {
      adConds.push(between(adSpend.date, range.from, range.to));
    }
    const adRows = await this.db
      .select({
        date: adSpend.date,
        spend: sql<string>`sum(${adSpend.spend})`,
      })
      .from(adSpend)
      .where(and(...adConds))
      .groupBy(adSpend.date);
    for (const a of adRows) {
      bucket(a.date).adSpend += num(a.spend);
    }

    // Ürün-seviyesi reklam atfı: ürün-seviyesi raporlar (product_ad_spend_daily)
    // + manuel eşleştirme allokasyonu (product_ad_links) öncelikli; artakalan
    // (eşlenmemiş) günlük harcama eşlemesiz ürünlere ciro-payı ile dağıtılır.
    await this.attributeProductAdSpend(channelId, range, products, daily);

    // Yaz (idempotent: aralığı/mağazayı temizle, yeniden ekle).
    await this.db.transaction(async (tx) => {
      if (range) {
        await tx
          .delete(dailyStoreMetrics)
          .where(
            and(
              eq(dailyStoreMetrics.channelId, channelId),
              between(dailyStoreMetrics.date, range.from, range.to),
            ),
          );
        await tx
          .delete(productProfitDaily)
          .where(
            and(
              eq(productProfitDaily.channelId, channelId),
              between(productProfitDaily.date, range.from, range.to),
            ),
          );
      } else {
        await tx
          .delete(dailyStoreMetrics)
          .where(eq(dailyStoreMetrics.channelId, channelId));
        await tx
          .delete(productProfitDaily)
          .where(eq(productProfitDaily.channelId, channelId));
      }

      if (daily.size > 0) {
        await tx.insert(dailyStoreMetrics).values(
          [...daily.entries()].map(([date, b]) => ({
            channelId,
            date,
            currency,
            revenue: f4(b.revenue),
            discounts: f4(b.discounts),
            refunds: f4(b.refunds),
            cogs: f4(b.cogs),
            shippingCost: f4(b.shippingCost),
            paymentFees: f4(b.paymentFees),
            taxes: f4(b.taxes),
            adSpend: f4(b.adSpend),
            customExpenses: f4(b.customExpenses),
            netProfit: f4(dailyNetProfit(b)),
            ordersCount: b.ordersCount,
            units: b.units,
          })),
        );
      }
      if (products.size > 0) {
        await tx.insert(productProfitDaily).values(
          [...products.values()].map((p) => ({
            channelId,
            date: p.date,
            productExternalId: p.productExternalId,
            title: p.title,
            currency,
            units: p.units,
            revenue: f4(p.revenue),
            cogs: f4(p.cogs),
            attributedAdSpend: f4(p.attributedAdSpend),
            netProfit: f4(p.net),
          })),
        );
      }
    });

    await this.invalidateStore(channelId, store.storeId);
    this.logger.log(
      `Rollup mağaza=${channelId}${range ? ` ${range.from}→${range.to}` : " (tam)"}: ${daily.size} gün, ${products.size} ürün-gün`,
    );
    return daily.size;
  }

  /**
   * Ürün-gün reklam atfını hesaplar (rollupStore içinden çağrılır, accumulator'ları
   * mutate eder). Öncelik: ürün-seviyesi raporlar (product_ad_spend_daily) + manuel
   * eşleştirme (product_ad_links → ad_spend entity harcaması, weight ile bölünür);
   * günün artakalan harcaması eşlemesiz ürünlere ciro-payı ile dağıtılır. Hiçbiri
   * yoksa davranış eski blended ciro-payına indirgenir (geri uyumlu).
   */
  private async attributeProductAdSpend(
    channelId: string,
    range: DateRange | undefined,
    products: Map<string, ProductAccumulator>,
    daily: Map<string, DailyMetricsAccumulator>,
  ): Promise<void> {
    // 1) Açık ürün-seviyesi harcama (auto raporlar + sentetik): date|pid → spend
    const espConds = [eq(productAdSpendDaily.channelId, channelId)];
    if (range) {
      espConds.push(between(productAdSpendDaily.date, range.from, range.to));
    }
    const espRows = await this.db
      .select({
        date: productAdSpendDaily.date,
        pid: productAdSpendDaily.productExternalId,
        spend: sql<string>`sum(${productAdSpendDaily.spend})`,
      })
      .from(productAdSpendDaily)
      .where(and(...espConds))
      .groupBy(
        productAdSpendDaily.date,
        productAdSpendDaily.productExternalId,
      );
    const explicit = new Map<string, number>();
    for (const r of espRows) explicit.set(`${r.date}|${r.pid}`, num(r.spend));

    // 2) Manuel eşleştirme allokasyonu: links → entity günlük spend → ürün(ler)e weight
    const links = await this.db
      .select({
        productExternalId: productAdLinks.productExternalId,
        provider: productAdLinks.provider,
        level: productAdLinks.level,
        entityExternalId: productAdLinks.adEntityExternalId,
        weight: productAdLinks.weight,
      })
      .from(productAdLinks)
      .where(eq(productAdLinks.channelId, channelId));

    const manual = new Map<string, number>(); // date|pid → spend
    if (links.length > 0) {
      const entityIds = [...new Set(links.map((l) => l.entityExternalId))];
      const adConds = [
        eq(adSpend.channelId, channelId),
        inArray(adSpend.entityExternalId, entityIds),
      ];
      if (range) adConds.push(between(adSpend.date, range.from, range.to));
      const adRows = await this.db
        .select({
          date: adSpend.date,
          provider: adSpend.provider,
          level: adSpend.level,
          entityExternalId: adSpend.entityExternalId,
          spend: sql<string>`sum(${adSpend.spend})`,
        })
        .from(adSpend)
        .where(and(...adConds))
        .groupBy(
          adSpend.date,
          adSpend.provider,
          adSpend.level,
          adSpend.entityExternalId,
        );
      const entitySpend = new Map<string, number>(); // provider|level|entity|date
      for (const r of adRows) {
        entitySpend.set(
          `${r.provider}|${r.level}|${r.entityExternalId}|${r.date}`,
          num(r.spend),
        );
      }
      const groupTotal = new Map<string, number>(); // provider|level|entity → Σweight
      for (const l of links) {
        const k = `${l.provider}|${l.level}|${l.entityExternalId}`;
        groupTotal.set(k, (groupTotal.get(k) ?? 0) + num(l.weight));
      }
      for (const l of links) {
        const gk = `${l.provider}|${l.level}|${l.entityExternalId}`;
        const total = groupTotal.get(gk) ?? 0;
        if (total <= 0) continue;
        const share = num(l.weight) / total;
        for (const date of daily.keys()) {
          const sp = entitySpend.get(`${gk}|${date}`);
          if (!sp) continue;
          const key = `${date}|${l.productExternalId}`;
          manual.set(key, (manual.get(key) ?? 0) + sp * share);
        }
      }
    }

    // 3) Ürün başına açık+manuel atfı; gün başına toplam + eşlemesiz ciro topla
    const dayAttributed = new Map<string, number>();
    const dayUnattrRevenue = new Map<string, number>();
    for (const p of products.values()) {
      const key = `${p.date}|${p.productExternalId}`;
      const direct = (explicit.get(key) ?? 0) + (manual.get(key) ?? 0);
      p.attributedAdSpend = direct;
      if (direct > 0) {
        dayAttributed.set(p.date, (dayAttributed.get(p.date) ?? 0) + direct);
      } else {
        dayUnattrRevenue.set(
          p.date,
          (dayUnattrRevenue.get(p.date) ?? 0) + p.revenue,
        );
      }
    }

    // 4) Artakalan günlük harcamayı eşlemesiz ürünlere ciro-payı ile dağıt;
    //    son olarak atfı ürün net kârından düş.
    for (const p of products.values()) {
      if (p.attributedAdSpend <= 0) {
        const day = daily.get(p.date);
        const unattrRev = dayUnattrRevenue.get(p.date) ?? 0;
        if (day && day.adSpend > 0 && unattrRev > 0) {
          const remaining = Math.max(
            0,
            day.adSpend - (dayAttributed.get(p.date) ?? 0),
          );
          p.attributedAdSpend = remaining * (p.revenue / unattrRev);
        }
      }
      p.net -= p.attributedAdSpend;
    }
  }

  /** Tüm aktif mağazaları tam yeniden hesaplar (gece scheduler). */
  async rollupAllActive(): Promise<number> {
    const active = await this.db
      .select({ id: channels.id })
      .from(channels)
      .where(eq(channels.status, "active"));
    let total = 0;
    for (const s of active) total += await this.rollupStore(s.id);
    return total;
  }

  /** Rollup işini kuyruğa alır (manuel tetikleme / artımlı). */
  async enqueueRollup(job: MetricsRollupJob): Promise<void> {
    await this.queue.add("rollup", job);
  }

  /** Manuel yeniden hesaplama: org-sahipliği doğrula, tam rollup kuyruğa al. */
  async requestRecompute(storeId: string, channelId: string): Promise<void> {
    await assertStoreInOrg(this.db, storeId, channelId);
    await this.enqueueRollup({ channelId });
  }

  // ---- okuma (cache'li) ----

  async getStoreMetrics(
    storeId: string,
    channelId: string,
    from: string,
    to: string,
  ): Promise<StoreMetricsSummary> {
    await assertStoreInOrg(this.db, storeId, channelId);

    const cacheKey = `metrics:${channelId}:${from}:${to}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as StoreMetricsSummary;

    const rows = await this.db
      .select()
      .from(dailyStoreMetrics)
      .where(
        and(
          eq(dailyStoreMetrics.channelId, channelId),
          between(dailyStoreMetrics.date, from, to),
        ),
      )
      .orderBy(asc(dailyStoreMetrics.date));

    const days: DailyStoreMetric[] = rows.map((r) => ({
      date: r.date,
      currency: r.currency,
      revenue: r.revenue,
      discounts: r.discounts,
      refunds: r.refunds,
      cogs: r.cogs,
      shippingCost: r.shippingCost,
      paymentFees: r.paymentFees,
      taxes: r.taxes,
      adSpend: r.adSpend,
      customExpenses: r.customExpenses,
      netProfit: r.netProfit,
      ordersCount: r.ordersCount,
      units: r.units,
    }));

    const currency = days[0]?.currency ?? "USD";
    const totals = computeTotals(days);
    const summary: StoreMetricsSummary = {
      channelId,
      currency,
      from,
      to,
      days,
      totals,
    };
    await this.redis.set(
      cacheKey,
      JSON.stringify(summary),
      "EX",
      CACHE_TTL_SECONDS,
    );
    return summary;
  }

  /** Ürün kârlılık sıralaması (net kâra göre azalan). */
  async getProductRanking(
    storeId: string,
    channelId: string,
    from: string,
    to: string,
    limit = 20,
  ): Promise<ProductProfitRow[]> {
    await assertStoreInOrg(this.db, storeId, channelId);

    const rows = await this.db
      .select({
        productExternalId: productProfitDaily.productExternalId,
        title: sql<string | null>`max(${productProfitDaily.title})`,
        currency: sql<string>`max(${productProfitDaily.currency})`,
        units: sql<number>`sum(${productProfitDaily.units})::int`,
        revenue: sql<string>`sum(${productProfitDaily.revenue})`,
        cogs: sql<string>`sum(${productProfitDaily.cogs})`,
        attributedAdSpend: sql<string>`sum(${productProfitDaily.attributedAdSpend})`,
        netProfit: sql<string>`sum(${productProfitDaily.netProfit})`,
      })
      .from(productProfitDaily)
      .where(
        and(
          eq(productProfitDaily.channelId, channelId),
          between(productProfitDaily.date, from, to),
        ),
      )
      .groupBy(productProfitDaily.productExternalId)
      .orderBy(desc(sql`sum(${productProfitDaily.netProfit})`))
      .limit(limit);

    return rows.map((r) => ({
      productExternalId: r.productExternalId,
      title: r.title,
      currency: r.currency,
      units: r.units,
      revenue: r.revenue,
      cogs: r.cogs,
      attributedAdSpend: r.attributedAdSpend,
      netProfit: r.netProfit,
    }));
  }

  /**
   * Rollup sonrası ilgili cache anahtarlarını siler: mağaza metrikleri
   * (`metrics:{store}:*`) + org analitik agregaları (`analytics:{org}:*`).
   */
  private async invalidateStore(
    channelId: string,
    storeId?: string,
  ): Promise<void> {
    const patterns = [`metrics:${channelId}:*`];
    if (storeId) patterns.push(`analytics:${storeId}:*`);
    for (const pattern of patterns) {
      let cursor = "0";
      do {
        const [next, keys] = await this.redis.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100,
        );
        cursor = next;
        if (keys.length > 0) await this.redis.del(...keys);
      } while (cursor !== "0");
    }
  }
}

function computeTotals(days: DailyStoreMetric[]): MetricsTotals {
  const acc = emptyDaily();
  for (const d of days) {
    acc.revenue += num(d.revenue);
    acc.discounts += num(d.discounts);
    acc.refunds += num(d.refunds);
    acc.cogs += num(d.cogs);
    acc.shippingCost += num(d.shippingCost);
    acc.paymentFees += num(d.paymentFees);
    acc.taxes += num(d.taxes);
    acc.adSpend += num(d.adSpend);
    acc.customExpenses += num(d.customExpenses);
    acc.ordersCount += d.ordersCount;
    acc.units += d.units;
  }
  const netProfit = dailyNetProfit(acc);
  const ratio = (n: number) =>
    acc.adSpend > 0 ? round4(n / acc.adSpend) : null;
  return {
    revenue: f4(acc.revenue),
    discounts: f4(acc.discounts),
    refunds: f4(acc.refunds),
    cogs: f4(acc.cogs),
    shippingCost: f4(acc.shippingCost),
    paymentFees: f4(acc.paymentFees),
    taxes: f4(acc.taxes),
    adSpend: f4(acc.adSpend),
    customExpenses: f4(acc.customExpenses),
    netProfit: f4(netProfit),
    ordersCount: acc.ordersCount,
    units: acc.units,
    margin: profitMargin(netProfit, acc.revenue),
    roas: ratio(acc.revenue),
    poas: ratio(netProfit),
  };
}
