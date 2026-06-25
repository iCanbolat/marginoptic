import { Inject, Injectable } from "@nestjs/common";
import type { AdProvider } from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { adEntities, adSpend } from "../../database/schema/ads";
import { productAdSpendDaily } from "../../database/schema/product-analytics";
import type { AdInsightsResult } from "../integrations/ads/ad-connector.types";

/**
 * Normalize edilmiş reklam insight'ını DB'ye idempotent yazar.
 * ad_entities → (store, provider, external) hedefiyle; ad_spend → (store, provider,
 * entity, date) hedefiyle `onConflictDoUpdate` (tekrarlı senkron çift kayıt yapmaz).
 */
@Injectable()
export class AdsIngestionService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async upsertInsights(
    storeId: string,
    connectionId: string,
    provider: AdProvider,
    result: AdInsightsResult,
  ): Promise<{ entities: number; spend: number; productSpend: number }> {
    const now = new Date();

    for (const e of result.entities) {
      await this.db
        .insert(adEntities)
        .values({
          storeId,
          connectionId,
          provider,
          level: e.level,
          externalId: e.externalId,
          name: e.name,
          parentExternalId: e.parentExternalId,
          campaignExternalId: e.campaignExternalId,
          status: e.status,
          currency: e.currency,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [adEntities.storeId, adEntities.provider, adEntities.externalId],
          set: {
            connectionId,
            level: e.level,
            name: e.name,
            parentExternalId: e.parentExternalId,
            campaignExternalId: e.campaignExternalId,
            status: e.status,
            currency: e.currency,
            updatedAt: now,
          },
        });
    }

    for (const s of result.spend) {
      await this.db
        .insert(adSpend)
        .values({
          storeId,
          connectionId,
          provider,
          date: s.date,
          level: s.level,
          entityExternalId: s.entityExternalId,
          campaignExternalId: s.campaignExternalId,
          name: s.name,
          spend: s.spend,
          impressions: s.impressions,
          clicks: s.clicks,
          conversions: s.conversions,
          conversionValue: s.conversionValue,
          currency: s.currency,
        })
        .onConflictDoUpdate({
          target: [
            adSpend.storeId,
            adSpend.provider,
            adSpend.entityExternalId,
            adSpend.date,
          ],
          set: {
            connectionId,
            level: s.level,
            campaignExternalId: s.campaignExternalId,
            name: s.name,
            spend: s.spend,
            impressions: s.impressions,
            clicks: s.clicks,
            conversions: s.conversions,
            conversionValue: s.conversionValue,
            currency: s.currency,
          },
        });
    }

    // Ürün-seviyesi harcama (yalnız ürün-raporlu sağlayıcılar / manuel allokasyon
    // sonrası). product_profit_daily ile (storeId, productExternalId, date) join olur.
    const productSpend = result.productSpend ?? [];
    for (const p of productSpend) {
      await this.db
        .insert(productAdSpendDaily)
        .values({
          storeId,
          date: p.date,
          productExternalId: p.productExternalId,
          provider,
          spend: p.spend,
          clicks: p.clicks,
          conversions: p.conversions,
          conversionValue: p.conversionValue,
        })
        .onConflictDoUpdate({
          target: [
            productAdSpendDaily.storeId,
            productAdSpendDaily.provider,
            productAdSpendDaily.productExternalId,
            productAdSpendDaily.date,
          ],
          set: {
            spend: p.spend,
            clicks: p.clicks,
            conversions: p.conversions,
            conversionValue: p.conversionValue,
          },
        });
    }

    return {
      entities: result.entities.length,
      spend: result.spend.length,
      productSpend: productSpend.length,
    };
  }
}
