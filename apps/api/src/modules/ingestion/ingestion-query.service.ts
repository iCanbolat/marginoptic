import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, ilike, lt, or } from "drizzle-orm";
import type {
  OrderRow,
  OrdersQuery,
  Paginated,
  StoreSyncStatus,
  SyncResourceStatus,
} from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { orders } from "../../database/schema/sales";
import {
  integrationConnections,
  stores,
  syncState,
} from "../../database/schema/stores";

interface Cursor {
  createdAt: string;
  id: string;
}

function encodeCursor(c: Cursor): string {
  return Buffer.from(`${c.createdAt}|${c.id}`).toString("base64url");
}

function decodeCursor(raw: string): Cursor | null {
  try {
    const [createdAt, id] = Buffer.from(raw, "base64url")
      .toString("utf8")
      .split("|");
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

/** Faz 3 okuma tarafı: sync durumu + ham sipariş listesi (org-kapsamlı). */
@Injectable()
export class IngestionQueryService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Mağazanın org'a ait olduğunu doğrular (yoksa 404). */
  private async assertStore(orgId: string, storeId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: stores.id })
      .from(stores)
      .where(and(eq(stores.id, storeId), eq(stores.organizationId, orgId)))
      .limit(1);
    if (!row) throw new NotFoundException("Mağaza bulunamadı");
  }

  async syncStatus(orgId: string, storeId: string): Promise<StoreSyncStatus> {
    await this.assertStore(orgId, storeId);

    const rows = await this.db
      .select({
        resource: syncState.resource,
        status: syncState.status,
        stats: syncState.stats,
        lastSyncedAt: syncState.lastSyncedAt,
        lastError: syncState.lastError,
        updatedAt: syncState.updatedAt,
      })
      .from(syncState)
      .innerJoin(
        integrationConnections,
        eq(syncState.connectionId, integrationConnections.id),
      )
      .where(eq(integrationConnections.storeId, storeId))
      .orderBy(syncState.resource);

    const resources: SyncResourceStatus[] = rows.map((r) => {
      const stats = (r.stats ?? {}) as { processed?: number; total?: number };
      return {
        resource: r.resource,
        status: r.status,
        processed: stats.processed ?? 0,
        total: stats.total ?? null,
        lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
        lastError: r.lastError,
        updatedAt: r.updatedAt.toISOString(),
      };
    });

    const lastSyncedAt = resources
      .map((r) => r.lastSyncedAt)
      .filter((v): v is string => v != null)
      .sort()
      .at(-1) ?? null;

    return {
      storeId,
      resources,
      complete:
        resources.length > 0 && resources.every((r) => r.status === "done"),
      lastSyncedAt,
    };
  }

  async listOrders(
    orgId: string,
    storeId: string,
    query: OrdersQuery,
  ): Promise<Paginated<OrderRow>> {
    await this.assertStore(orgId, storeId);

    const conds = [eq(orders.storeId, storeId)];
    if (query.financialStatus) {
      conds.push(eq(orders.financialStatus, query.financialStatus));
    }
    if (query.search) {
      const like = `%${query.search}%`;
      const match = or(ilike(orders.name, like), ilike(orders.email, like));
      if (match) conds.push(match);
    }
    if (query.cursor) {
      const c = decodeCursor(query.cursor);
      if (c) {
        const keyset = or(
          lt(orders.createdAt, new Date(c.createdAt)),
          and(
            eq(orders.createdAt, new Date(c.createdAt)),
            lt(orders.id, c.id),
          ),
        );
        if (keyset) conds.push(keyset);
      }
    }

    const rows = await this.db
      .select({
        id: orders.id,
        externalId: orders.externalId,
        name: orders.name,
        email: orders.email,
        financialStatus: orders.financialStatus,
        fulfillmentStatus: orders.fulfillmentStatus,
        currency: orders.currency,
        totalPrice: orders.totalPrice,
        totalRefunded: orders.totalRefunded,
        test: orders.test,
        processedAt: orders.processedAt,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(and(...conds))
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(query.limit + 1);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : null;

    return {
      items: page.map(
        (r): OrderRow => ({
          id: r.id,
          externalId: r.externalId,
          name: r.name,
          email: r.email,
          financialStatus: r.financialStatus,
          fulfillmentStatus: r.fulfillmentStatus,
          currency: r.currency,
          totalPrice: r.totalPrice,
          totalRefunded: r.totalRefunded,
          test: r.test,
          processedAt: r.processedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
        }),
      ),
      nextCursor,
    };
  }
}
