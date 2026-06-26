import { Injectable, Logger } from "@nestjs/common";
import type { EbaySyncResource } from "../sync/sync.constants";
import { EbayConnector } from "../integrations/ebay/ebay.connector";
import { IngestionService } from "./ingestion.service";
import { generateEbaySynthetic } from "./ebay/ebay-synthetic";
import {
  normalizeEbayBuyer,
  normalizeEbayInventoryItem,
  normalizeEbayOrder,
} from "./ebay/ebay-normalizer";

export type BackfillProgress = (processed: number, total: number) => Promise<void>;

interface EbayBackfillArgs {
  channelId: string;
  /** eBay satıcı kimliği (canlı fetch için); dev'de mağaza adı (sentetik seed). */
  shopId: string;
  accessToken: string;
  resource: EbaySyncResource;
  /** ISO; verilirse orders artımlı çekilir (polling watermark). */
  since?: string;
}

const PROGRESS_EVERY = 25;

/**
 * Faz 10 — eBay tarihsel/artımlı veri backfill'i. Dev token (`dev_`) → sentetik API-şekilli
 * veri; aksi halde eBay Sell API. Her iki yol da aynı normalizer + IngestionService idempotent
 * upsert'ini kullanır (Shopify backfill ile aynı desen).
 */
@Injectable()
export class EbayBackfillService {
  private readonly logger = new Logger(EbayBackfillService.name);

  constructor(
    private readonly connector: EbayConnector,
    private readonly ingestion: IngestionService,
  ) {}

  async run(
    args: EbayBackfillArgs,
    onProgress?: BackfillProgress,
  ): Promise<{ processed: number; total: number }> {
    const nodes = args.accessToken.startsWith("dev_")
      ? generateEbaySynthetic(args.resource, args.shopId)
      : await this.connector.fetchResource(
          args.resource,
          args.accessToken,
          args.since,
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
          await this.ingestion.upsertOrder(args.channelId, normalizeEbayOrder(n));
          await tick();
        }
        break;
      case "products":
        for (const n of nodes) {
          await this.ingestion.upsertProduct(
            args.channelId,
            normalizeEbayInventoryItem(n),
          );
          await tick();
        }
        break;
      case "customers":
        for (const n of nodes) {
          await this.ingestion.upsertCustomer(args.channelId, normalizeEbayBuyer(n));
          await tick();
        }
        break;
    }

    this.logger.log(`eBay backfill ${args.resource}: ${processed}/${total} (${args.shopId})`);
    return { processed, total };
  }
}
