import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { StoreSummary } from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { stores } from "../../database/schema/stores";

type StoreRow = typeof stores.$inferSelect;

function toSummary(row: StoreRow): StoreSummary {
  return {
    id: row.id,
    channel: row.channel,
    name: row.name,
    externalShopId: row.externalShopId,
    domain: row.domain,
    currency: row.currency,
    status: row.status,
  };
}

@Injectable()
export class StoresService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async listForOrg(orgId: string): Promise<StoreSummary[]> {
    const rows = await this.db
      .select()
      .from(stores)
      .where(eq(stores.organizationId, orgId))
      .orderBy(stores.createdAt);
    return rows.map(toSummary);
  }

  async getForOrg(orgId: string, id: string): Promise<StoreSummary> {
    const [row] = await this.db
      .select()
      .from(stores)
      .where(and(eq(stores.organizationId, orgId), eq(stores.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException("Mağaza bulunamadı");
    return toSummary(row);
  }

  async disconnect(orgId: string, id: string): Promise<void> {
    const result = await this.db
      .update(stores)
      .set({ status: "disconnected", updatedAt: new Date() })
      .where(and(eq(stores.organizationId, orgId), eq(stores.id, id)))
      .returning({ id: stores.id });
    if (result.length === 0) throw new NotFoundException("Mağaza bulunamadı");
  }
}
