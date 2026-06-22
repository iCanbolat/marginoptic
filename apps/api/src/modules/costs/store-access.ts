import { NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { DrizzleDB } from "../../database/database.module";
import { stores } from "../../database/schema/stores";

/** Mağazanın org'a ait olduğunu doğrular (yoksa 404), currency'yi döner. */
export async function assertStoreInOrg(
  db: DrizzleDB,
  orgId: string,
  storeId: string,
): Promise<{ currency: string }> {
  const [row] = await db
    .select({ currency: stores.currency })
    .from(stores)
    .where(and(eq(stores.id, storeId), eq(stores.organizationId, orgId)))
    .limit(1);
  if (!row) throw new NotFoundException("Mağaza bulunamadı");
  return row;
}
