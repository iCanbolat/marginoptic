import { NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { DrizzleDB } from "../../database/database.module";
import { stores } from "../../database/schema/stores";

export interface OrgStore {
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
export async function resolveOrgStores(
  db: DrizzleDB,
  orgId: string,
  requestedIds: string[],
): Promise<OrgStore[]> {
  const all = await db
    .select({
      id: stores.id,
      name: stores.name,
      currency: stores.currency,
      channel: stores.channel,
    })
    .from(stores)
    .where(eq(stores.organizationId, orgId));

  if (requestedIds.length === 0) return all;

  const byId = new Map(all.map((s) => [s.id, s]));
  const missing = requestedIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new NotFoundException("Mağaza bulunamadı");
  }
  return requestedIds.map((id) => byId.get(id) as OrgStore);
}
