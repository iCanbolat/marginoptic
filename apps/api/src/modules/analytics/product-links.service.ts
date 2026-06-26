import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import type {
  AdEntityOption,
  AdLevel,
  AdProvider,
  ProductAdLink,
  ProductAdLinkCreateInput,
} from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { adEntities } from "../../database/schema/ads";
import { productAdLinks } from "../../database/schema/product-analytics";
import { assertStoreInOrg } from "../costs/store-access";
import { MetricsService } from "../profit/metrics.service";

/**
 * Ürün↔reklam manuel eşleştirme CRUD (Amazon/eBay ürünleri ↔ Meta/Google reklam
 * varlıkları). Link değişince mağaza rollup'ı tetiklenir → ürün atfı yeniden
 * hesaplanır (product_profit_daily.attributedAdSpend güncellenir).
 */
@Injectable()
export class ProductLinksService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly metrics: MetricsService,
  ) {}

  async list(
    storeId: string,
    channelId: string,
    productExternalId?: string,
  ): Promise<ProductAdLink[]> {
    await assertStoreInOrg(this.db, storeId, channelId);
    const conds = [eq(productAdLinks.channelId, channelId)];
    if (productExternalId) {
      conds.push(eq(productAdLinks.productExternalId, productExternalId));
    }
    const rows = await this.db
      .select()
      .from(productAdLinks)
      .where(and(...conds))
      .orderBy(asc(productAdLinks.createdAt));
    return rows.map((r) => this.toDto(r));
  }

  async create(
    storeId: string,
    channelId: string,
    input: ProductAdLinkCreateInput,
  ): Promise<ProductAdLink> {
    await assertStoreInOrg(this.db, storeId, channelId);
    const [row] = await this.db
      .insert(productAdLinks)
      .values({
        channelId,
        productExternalId: input.productExternalId,
        provider: input.provider,
        adEntityExternalId: input.adEntityExternalId,
        level: input.level,
        matchType: "manual",
        weight: String(input.weight),
      })
      .onConflictDoUpdate({
        target: [
          productAdLinks.channelId,
          productAdLinks.productExternalId,
          productAdLinks.provider,
          productAdLinks.adEntityExternalId,
        ],
        set: {
          level: input.level,
          matchType: "manual",
          weight: String(input.weight),
        },
      })
      .returning();
    // Atıf yeniden hesaplansın.
    await this.metrics.requestRecompute(storeId, channelId);
    return this.toDto(row);
  }

  async remove(storeId: string, channelId: string, id: string): Promise<void> {
    await assertStoreInOrg(this.db, storeId, channelId);
    await this.db
      .delete(productAdLinks)
      .where(and(eq(productAdLinks.id, id), eq(productAdLinks.channelId, channelId)));
    await this.metrics.requestRecompute(storeId, channelId);
  }

  /** Eşleştirme UI'ı için seçilebilir reklam varlıkları (kampanya/adset/ad). */
  async adEntityOptions(
    storeId: string,
    channelId: string,
    provider?: AdProvider,
  ): Promise<AdEntityOption[]> {
    await assertStoreInOrg(this.db, storeId, channelId);
    const conds = [eq(adEntities.channelId, channelId)];
    if (provider) conds.push(eq(adEntities.provider, provider));
    const rows = await this.db
      .select({
        provider: adEntities.provider,
        level: adEntities.level,
        externalId: adEntities.externalId,
        campaignExternalId: adEntities.campaignExternalId,
        name: adEntities.name,
      })
      .from(adEntities)
      .where(and(...conds))
      .orderBy(asc(adEntities.level), asc(adEntities.name))
      .limit(500);
    return rows.map((r) => ({
      provider: r.provider as AdProvider,
      level: r.level as AdLevel,
      externalId: r.externalId,
      campaignExternalId: r.campaignExternalId,
      name: r.name,
    }));
  }

  private toDto(r: typeof productAdLinks.$inferSelect): ProductAdLink {
    return {
      id: r.id,
      channelId: r.channelId,
      productExternalId: r.productExternalId,
      provider: r.provider as AdProvider,
      adEntityExternalId: r.adEntityExternalId,
      level: r.level as AdLevel,
      matchType: r.matchType,
      weight: r.weight,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
