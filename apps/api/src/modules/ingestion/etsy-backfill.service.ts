import { Injectable, Logger } from "@nestjs/common";
import type { EtsySyncResource } from "../sync/sync.constants";
import { EtsyConnector } from "../integrations/etsy/etsy.connector";
import { IngestionService } from "./ingestion.service";
import { generateEtsySynthetic } from "./etsy/etsy-synthetic";
import {
  normalizeEtsyBuyer,
  normalizeEtsyListing,
  normalizeEtsyReceipt,
} from "./etsy/etsy-normalizer";

export type BackfillProgress = (processed: number, total: number) => Promise<void>;

interface EtsyBackfillArgs {
  storeId: string;
  shopId: string;
  accessToken: string;
  resource: EtsySyncResource;
}

const PROGRESS_EVERY = 25;

/**
 * Faz 9 — Etsy tarihsel veri backfill'i. Dev token (`dev_`) → sentetik API-şekilli
 * veri; aksi halde Etsy Open API v3. Her iki yol da aynı normalizer + IngestionService
 * idempotent upsert'ini kullanır (Shopify backfill ile aynı desen).
 */
@Injectable()
export class EtsyBackfillService {
  private readonly logger = new Logger(EtsyBackfillService.name);

  constructor(
    private readonly connector: EtsyConnector,
    private readonly ingestion: IngestionService,
  ) {}

  async run(
    args: EtsyBackfillArgs,
    onProgress?: BackfillProgress,
  ): Promise<{ processed: number; total: number }> {
    const nodes = args.accessToken.startsWith("dev_")
      ? generateEtsySynthetic(args.resource, args.shopId)
      : await this.connector.fetchResource(
          args.resource,
          args.shopId,
          args.accessToken,
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
          await this.ingestion.upsertOrder(args.storeId, normalizeEtsyReceipt(n));
          await tick();
        }
        break;
      case "products":
        for (const n of nodes) {
          await this.ingestion.upsertProduct(args.storeId, normalizeEtsyListing(n));
          await tick();
        }
        break;
      case "customers":
        for (const n of nodes) {
          await this.ingestion.upsertCustomer(args.storeId, normalizeEtsyBuyer(n));
          await tick();
        }
        break;
    }

    this.logger.log(`Etsy backfill ${args.resource}: ${processed}/${total} (${args.shopId})`);
    return { processed, total };
  }
}
