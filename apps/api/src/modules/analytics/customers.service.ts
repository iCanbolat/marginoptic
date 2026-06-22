import { Inject, Injectable } from "@nestjs/common";
import { and, between, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { Redis } from "ioredis";
import type {
  AnalyticsFilter,
  CohortRow,
  CustomerCacResponse,
  CustomerCohortsResponse,
  CustomerLtvResponse,
  TopCustomer,
} from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { dailyStoreMetrics } from "../../database/schema/metrics";
import { orders } from "../../database/schema/sales";
import { REDIS } from "../../redis/redis.module";
import { f4, num } from "./analytics-math";
import { resolveOrgStores } from "./org-stores";

const CACHE_TTL = 300;

interface OrderFact {
  customerKey: string; // storeId|customerExternalId
  storeId: string;
  customerExternalId: string;
  email: string | null;
  date: string; // YYYY-MM-DD
  revenue: number; // totalPrice − totalRefunded
}

const month = (date: string): string => date.slice(0, 7);
const monthsDiff = (a: string, b: string): number => {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
};

/**
 * Faz 7 — Müşteri analitiği: LTV (müşteri başına ortalama ciro), CAC (reklam/yeni
 * müşteri) ve kohort tutundurma. Çok-mağaza müşteri kimliği `storeId:customerExternalId`
 * ile ayrıştırılır. Cohort tam geçmiş gerektirdiğinden mağazanın tüm siparişleri okunur.
 */
@Injectable()
export class CustomersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async ltv(orgId: string, filter: AnalyticsFilter): Promise<CustomerLtvResponse> {
    return this.cached(orgId, "ltv", filter, async () => {
      const stores = await resolveOrgStores(this.db, orgId, filter.storeIds);
      const currency = stores[0]?.currency ?? "USD";
      const facts = await this.loadOrders(stores.map((s) => s.id));

      // Müşteri başına ilk sipariş (tüm geçmiş) + aralık-içi aktivite.
      const firstOrder = new Map<string, string>();
      for (const f of facts) {
        const cur = firstOrder.get(f.customerKey);
        if (!cur || f.date < cur) firstOrder.set(f.customerKey, f.date);
      }

      const inRange = facts.filter(
        (f) => f.date >= filter.from && f.date <= filter.to,
      );
      const perCustomer = new Map<
        string,
        { storeId: string; cust: string; email: string | null; orders: number; revenue: number }
      >();
      let totalOrders = 0;
      let totalRevenue = 0;
      for (const f of inRange) {
        totalOrders += 1;
        totalRevenue += f.revenue;
        let c = perCustomer.get(f.customerKey);
        if (!c) {
          c = {
            storeId: f.storeId,
            cust: f.customerExternalId,
            email: f.email,
            orders: 0,
            revenue: 0,
          };
          perCustomer.set(f.customerKey, c);
        }
        c.orders += 1;
        c.revenue += f.revenue;
        if (!c.email && f.email) c.email = f.email;
      }

      const customerCount = perCustomer.size;
      let newCustomers = 0;
      for (const key of perCustomer.keys()) {
        const fo = firstOrder.get(key);
        if (fo && fo >= filter.from && fo <= filter.to) newCustomers += 1;
      }
      const returningCustomers = customerCount - newCustomers;

      const topCustomers: TopCustomer[] = [...perCustomer.values()]
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map((c) => ({
          storeId: c.storeId,
          customerExternalId: c.cust,
          email: c.email,
          orders: c.orders,
          revenue: f4(c.revenue),
        }));

      return {
        from: filter.from,
        to: filter.to,
        currency,
        customerCount,
        newCustomers,
        returningCustomers,
        repeatRate:
          customerCount > 0
            ? Math.round((returningCustomers / customerCount) * 1e4) / 100
            : null,
        avgOrderValue: totalOrders > 0 ? f4(totalRevenue / totalOrders) : "0.0000",
        avgOrdersPerCustomer:
          customerCount > 0
            ? Math.round((totalOrders / customerCount) * 100) / 100
            : 0,
        avgRevenuePerCustomer:
          customerCount > 0 ? f4(totalRevenue / customerCount) : "0.0000",
        topCustomers,
      };
    });
  }

  async cac(orgId: string, filter: AnalyticsFilter): Promise<CustomerCacResponse> {
    return this.cached(orgId, "cac", filter, async () => {
      const stores = await resolveOrgStores(this.db, orgId, filter.storeIds);
      const ids = stores.map((s) => s.id);
      const currency = stores[0]?.currency ?? "USD";

      const facts = await this.loadOrders(ids);
      const firstOrder = new Map<string, string>();
      for (const f of facts) {
        const cur = firstOrder.get(f.customerKey);
        if (!cur || f.date < cur) firstOrder.set(f.customerKey, f.date);
      }
      let newCustomers = 0;
      for (const fo of firstOrder.values()) {
        if (fo >= filter.from && fo <= filter.to) newCustomers += 1;
      }

      const adSpend = await this.sumAdSpend(ids, filter.from, filter.to);
      return {
        from: filter.from,
        to: filter.to,
        currency,
        adSpend: f4(adSpend),
        newCustomers,
        cac: newCustomers > 0 ? f4(adSpend / newCustomers) : null,
      };
    });
  }

  async cohorts(
    orgId: string,
    filter: AnalyticsFilter,
  ): Promise<CustomerCohortsResponse> {
    return this.cached(orgId, "cohorts", filter, async () => {
      const stores = await resolveOrgStores(this.db, orgId, filter.storeIds);
      const facts = await this.loadOrders(stores.map((s) => s.id));

      const firstMonth = new Map<string, string>();
      for (const f of facts) {
        const m = month(f.date);
        const cur = firstMonth.get(f.customerKey);
        if (!cur || m < cur) firstMonth.set(f.customerKey, m);
      }

      const fromMonth = month(filter.from);
      const toMonth = month(filter.to);

      // cohort → size (distinct müşteri) ; (cohort,monthIndex) → {customers set, revenue}
      const cohortSize = new Map<string, Set<string>>();
      const cells = new Map<string, { customers: Set<string>; revenue: number }>();

      for (const f of facts) {
        const cohort = firstMonth.get(f.customerKey);
        if (!cohort || cohort < fromMonth || cohort > toMonth) continue;
        let sizeSet = cohortSize.get(cohort);
        if (!sizeSet) {
          sizeSet = new Set();
          cohortSize.set(cohort, sizeSet);
        }
        sizeSet.add(f.customerKey);

        const idx = monthsDiff(cohort, month(f.date));
        if (idx < 0) continue;
        const cellKey = `${cohort}|${idx}`;
        let cell = cells.get(cellKey);
        if (!cell) {
          cell = { customers: new Set(), revenue: 0 };
          cells.set(cellKey, cell);
        }
        cell.customers.add(f.customerKey);
        cell.revenue += f.revenue;
      }

      const cohorts: CohortRow[] = [...cohortSize.keys()]
        .sort()
        .map((cohort) => {
          const size = cohortSize.get(cohort)?.size ?? 0;
          const indices = [...cells.keys()]
            .filter((k) => k.startsWith(`${cohort}|`))
            .map((k) => Number(k.split("|")[1]))
            .sort((a, b) => a - b);
          return {
            cohort,
            size,
            cells: indices.map((idx) => {
              const cell = cells.get(`${cohort}|${idx}`);
              const customers = cell?.customers.size ?? 0;
              return {
                monthIndex: idx,
                customers,
                revenue: f4(cell?.revenue ?? 0),
                retentionPct:
                  size > 0 ? Math.round((customers / size) * 1e4) / 100 : null,
              };
            }),
          };
        });

      return { from: filter.from, to: filter.to, cohorts };
    });
  }

  // ---- Yardımcılar ----

  /** Mağazaların (test olmayan, müşteri kimlikli) tüm siparişleri → OrderFact. */
  private async loadOrders(storeIds: string[]): Promise<OrderFact[]> {
    if (storeIds.length === 0) return [];
    const rows = await this.db
      .select({
        storeId: orders.storeId,
        customerExternalId: orders.customerExternalId,
        email: orders.email,
        processedAt: orders.processedAt,
        shopifyCreatedAt: orders.shopifyCreatedAt,
        createdAt: orders.createdAt,
        totalPrice: orders.totalPrice,
        totalRefunded: orders.totalRefunded,
      })
      .from(orders)
      .where(
        and(
          inArray(orders.storeId, storeIds),
          eq(orders.test, false),
          isNotNull(orders.customerExternalId),
        ),
      );

    return rows.map((r) => {
      const at = r.processedAt ?? r.shopifyCreatedAt ?? r.createdAt;
      const cust = r.customerExternalId as string;
      return {
        customerKey: `${r.storeId}|${cust}`,
        storeId: r.storeId,
        customerExternalId: cust,
        email: r.email,
        date: at.toISOString().slice(0, 10),
        revenue: num(r.totalPrice) - num(r.totalRefunded),
      };
    });
  }

  private async sumAdSpend(
    storeIds: string[],
    from: string,
    to: string,
  ): Promise<number> {
    if (storeIds.length === 0) return 0;
    const [row] = await this.db
      .select({
        spend: sql<string>`coalesce(sum(${dailyStoreMetrics.adSpend}),0)`,
      })
      .from(dailyStoreMetrics)
      .where(
        and(
          inArray(dailyStoreMetrics.storeId, storeIds),
          between(dailyStoreMetrics.date, from, to),
        ),
      );
    return num(row?.spend);
  }

  private async cached<T>(
    orgId: string,
    endpoint: string,
    filter: AnalyticsFilter,
    fn: () => Promise<T>,
  ): Promise<T> {
    const stores = filter.storeIds.length
      ? [...filter.storeIds].sort().join(",")
      : "all";
    const key = `analytics:${orgId}:customers:${endpoint}:${filter.from}:${filter.to}:${stores}`;
    const hit = await this.redis.get(key);
    if (hit) return JSON.parse(hit) as T;
    const val = await fn();
    await this.redis.set(key, JSON.stringify(val), "EX", CACHE_TTL);
    return val;
  }
}
