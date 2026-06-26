import { NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { DrizzleDB } from "../../database/database.module";
import { channels } from "../../database/schema/channels";

/** Mağazanın org'a ait olduğunu doğrular (yoksa 404), currency'yi döner. */
export async function assertStoreInOrg(
  db: DrizzleDB,
  storeId: string,
  channelId: string,
): Promise<{ currency: string }> {
  const [row] = await db
    .select({ currency: channels.currency })
    .from(channels)
    .where(and(eq(channels.id, channelId), eq(channels.storeId, storeId)))
    .limit(1);
  if (!row) throw new NotFoundException("Mağaza bulunamadı");
  return row;
}
