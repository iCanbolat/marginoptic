import { Injectable, Logger } from "@nestjs/common";
import type { ShopifySyncResource } from "../sync/sync.constants";
import { IngestionService } from "./ingestion.service";
import {
  normalizeCustomer,
  normalizeOrder,
  normalizeProduct,
} from "./normalizers/shopify-normalizer";
import { ShopifyBulkService } from "./shopify/shopify-bulk.service";
import { generateSynthetic } from "./shopify/synthetic";

export type BackfillProgress = (processed: number, total: number) => Promise<void>;

interface BackfillArgs {
  storeId: string;
  shop: string;
  accessToken: string;
  resource: ShopifySyncResource;
}

const PROGRESS_EVERY = 25;

/**
 * Bir kaynağın tarihsel verisini çeker → normalize eder → idempotent yazar.
 * Dev bağlantıları (`dev_` token) için gerçek Shopify yerine sentetik veri kullanır,
 * böylece tüm hat (normalize → upsert → sync_state) gerçek mağaza olmadan doğrulanır.
 */
@Injectable()
export class ShopifyBackfillService {
  private readonly logger = new Logger(ShopifyBackfillService.name);

  constructor(
    private readonly bulk: ShopifyBulkService,
    private readonly ingestion: IngestionService,
  ) {}

  async run(
    args: BackfillArgs,
    onProgress?: BackfillProgress,
  ): Promise<{ processed: number; total: number }> {
    const nodes = args.accessToken.startsWith("dev_")
      ? generateSynthetic(args.resource, args.shop)
      : await this.bulk.fetchResource(
          args.shop,
          args.accessToken,
          args.resource,
        );

    const total = nodes.length;
    let processed = 0;
    const tick = async () => {
      processed += 1;
      if (processed % PROGRESS_EVERY === 0 || processed === total) {
        await onProgress?.(processed, total);
      }
    };

    if (total === 0) {
      await onProgress?.(0, 0);
      return { processed: 0, total: 0 };
    }

    switch (args.resource) {
      case "orders":
        for (const n of nodes) {
          await this.ingestion.upsertOrder(args.storeId, normalizeOrder(n));
          await tick();
        }
        break;
      case "products":
        for (const n of nodes) {
          await this.ingestion.upsertProduct(args.storeId, normalizeProduct(n));
          await tick();
        }
        break;
      case "customers":
        for (const n of nodes) {
          await this.ingestion.upsertCustomer(
            args.storeId,
            normalizeCustomer(n),
          );
          await tick();
        }
        break;
    }

    this.logger.log(
      `Backfill ${args.resource}: ${processed}/${total} (${args.shop})`,
    );
    return { processed, total };
  }
}
