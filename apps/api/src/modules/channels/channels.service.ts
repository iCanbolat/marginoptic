import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { ChannelSummary } from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { channels } from "../../database/schema/channels";

type StoreRow = typeof channels.$inferSelect;

function toSummary(row: StoreRow): ChannelSummary {
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
export class ChannelsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async listForOrg(storeId: string): Promise<ChannelSummary[]> {
    const rows = await this.db
      .select()
      .from(channels)
      .where(eq(channels.storeId, storeId))
      .orderBy(channels.createdAt);
    return rows.map(toSummary);
  }

  async getForOrg(storeId: string, id: string): Promise<ChannelSummary> {
    const [row] = await this.db
      .select()
      .from(channels)
      .where(and(eq(channels.storeId, storeId), eq(channels.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException("Mağaza bulunamadı");
    return toSummary(row);
  }

  async disconnect(storeId: string, id: string): Promise<void> {
    const result = await this.db
      .update(channels)
      .set({ status: "disconnected", updatedAt: new Date() })
      .where(and(eq(channels.storeId, storeId), eq(channels.id, id)))
      .returning({ id: channels.id });
    if (result.length === 0) throw new NotFoundException("Mağaza bulunamadı");
  }
}
