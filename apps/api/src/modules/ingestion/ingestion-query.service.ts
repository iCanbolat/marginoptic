import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
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
  channels,
  syncState,
} from "../../database/schema/channels";

/** Faz 3 okuma tarafı: sync durumu + ham sipariş listesi (org-kapsamlı). */
@Injectable()
export class IngestionQueryService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Mağazanın org'a ait olduğunu doğrular (yoksa 404). */
  private async assertStore(storeId: string, channelId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: channels.id })
      .from(channels)
      .where(and(eq(channels.id, channelId), eq(channels.storeId, storeId)))
      .limit(1);
    if (!row) throw new NotFoundException("Mağaza bulunamadı");
  }

  async syncStatus(storeId: string, channelId: string): Promise<StoreSyncStatus> {
    await this.assertStore(storeId, channelId);

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
      .where(eq(integrationConnections.channelId, channelId))
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
      channelId,
      resources,
      complete:
        resources.length > 0 && resources.every((r) => r.status === "done"),
      lastSyncedAt,
    };
  }

  async listOrders(
    storeId: string,
    channelId: string,
    query: OrdersQuery,
  ): Promise<Paginated<OrderRow>> {
    await this.assertStore(storeId, channelId);

    const conds = [eq(orders.channelId, channelId)];
    if (query.financialStatus) {
      conds.push(eq(orders.financialStatus, query.financialStatus));
    }
    if (query.search) {
      const like = `%${query.search}%`;
      const match = or(ilike(orders.name, like), ilike(orders.email, like));
      if (match) conds.push(match);
    }

    const where = and(...conds);
    const offset = (query.page - 1) * query.pageSize;

    // Toplam sayım ("Sayfa X / Y" için) + sayfa verisi tek istek turunda.
    const [[{ total }], rows] = await Promise.all([
      this.db.select({ total: count() }).from(orders).where(where),
      this.db
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
        .where(where)
        .orderBy(desc(orders.createdAt), desc(orders.id))
        .limit(query.pageSize)
        .offset(offset),
    ]);

    return {
      items: rows.map(
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
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
