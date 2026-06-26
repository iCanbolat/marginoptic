import { NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { DrizzleDB } from "../../database/database.module";
import { channels } from "../../database/schema/channels";

export interface StoreChannel {
  id: string;
  name: string;
  currency: string;
  channel: string;
}

/**
 * Org'un mağazalarını çözer. `requestedIds` boşsa org'un tüm mağazaları döner;
 * doluysa yalnız istenenler — istenen bir mağaza org'a ait değilse 404.
 * Raporlama para birimi ilk mağazanın para birimidir (çok-para FX dönüşümü yok).
 */
export async function resolveStoreChannels(
  db: DrizzleDB,
  storeId: string,
  requestedIds: string[],
): Promise<StoreChannel[]> {
  const all = await db
    .select({
      id: channels.id,
      name: channels.name,
      currency: channels.currency,
      channel: channels.channel,
    })
    .from(channels)
    .where(eq(channels.storeId, storeId));

  if (requestedIds.length === 0) return all;

  const byId = new Map(all.map((s) => [s.id, s]));
  const missing = requestedIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new NotFoundException("Mağaza bulunamadı");
  }
  return requestedIds.map((id) => byId.get(id) as StoreChannel);
}
