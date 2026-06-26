import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { StoreView } from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { stores } from "../../database/schema/auth";
import { BillingService } from "../billing/billing.service";
import { slugify } from "./slug.util";

export type StoreRow = typeof stores.$inferSelect;

function toView(row: StoreRow): StoreView {
  return { id: row.id, name: row.name, slug: row.slug };
}

/**
 * Mağaza (store = üst grup) yönetimi. Her mağaza tek bir kullanıcıya aittir
 * (`ownerUserId`). Tablo adı tarihsel sebeple `stores`.
 */
@Injectable()
export class StoresService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly billing: BillingService,
  ) {}

  /** Kullanıcının sahip olduğu mağazalar (oluşturma sırasına göre). */
  async listForUser(userId: string): Promise<StoreView[]> {
    const rows = await this.db
      .select()
      .from(stores)
      .where(eq(stores.ownerUserId, userId))
      .orderBy(stores.createdAt);
    return rows.map(toView);
  }

  async getById(storeId: string): Promise<StoreRow | undefined> {
    const [row] = await this.db
      .select()
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);
    return row;
  }

  /** Kullanıcı bu mağazanın sahibi mi? */
  async ownsStore(userId: string, storeId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: stores.id })
      .from(stores)
      .where(
        and(eq(stores.id, storeId), eq(stores.ownerUserId, userId)),
      )
      .limit(1);
    return Boolean(row);
  }

  /** Yeni mağaza oluştur (plan store limitini uygular). */
  async createForOwner(userId: string, name: string): Promise<StoreView> {
    await this.billing.assertCanAddStore(userId);
    const [org] = await this.db
      .insert(stores)
      .values({ ownerUserId: userId, name, slug: slugify(name) })
      .returning();
    return toView(org);
  }

  async rename(
    userId: string,
    storeId: string,
    name: string,
  ): Promise<StoreView> {
    const [row] = await this.db
      .update(stores)
      .set({ name, slug: slugify(name), updatedAt: new Date() })
      .where(
        and(eq(stores.id, storeId), eq(stores.ownerUserId, userId)),
      )
      .returning();
    if (!row) throw new NotFoundException("Mağaza bulunamadı");
    return toView(row);
  }

  /** Mağazayı sil (FK cascade ile kanallar + satış verisi de silinir). */
  async deleteForOwner(userId: string, storeId: string): Promise<void> {
    const result = await this.db
      .delete(stores)
      .where(
        and(eq(stores.id, storeId), eq(stores.ownerUserId, userId)),
      )
      .returning({ id: stores.id });
    if (result.length === 0) throw new NotFoundException("Mağaza bulunamadı");
  }
}
