import { Injectable, Logger } from "@nestjs/common";
import type { AmazonSyncResource } from "../sync/sync.constants";
import { AmazonConnector } from "../integrations/amazon/amazon.connector";
import { IngestionService } from "./ingestion.service";
import { generateAmazonSynthetic } from "./amazon/amazon-synthetic";
import {
  normalizeAmazonBuyer,
  normalizeAmazonListing,
  normalizeAmazonOrder,
} from "./amazon/amazon-normalizer";

export type BackfillProgress = (processed: number, total: number) => Promise<void>;

interface AmazonBackfillArgs {
  channelId: string;
  /** Amazon marketplace/satıcı kimliği (canlı fetch için); dev'de satıcı adı (sentetik seed). */
  shopId: string;
  accessToken: string;
  resource: AmazonSyncResource;
  /** ISO; verilirse orders `LastUpdatedAfter` ile artımlı çekilir (polling watermark). */
  since?: string;
}

const PROGRESS_EVERY = 25;

/**
 * Faz 10 — Amazon tarihsel/artımlı veri backfill'i. Dev token (`dev_`) → sentetik API-şekilli
 * veri; aksi halde Amazon SP-API. Her iki yol da aynı normalizer + IngestionService idempotent
 * upsert'ini kullanır (eBay backfill ile aynı desen).
 */
@Injectable()
export class AmazonBackfillService {
  private readonly logger = new Logger(AmazonBackfillService.name);

  constructor(
    private readonly connector: AmazonConnector,
    private readonly ingestion: IngestionService,
  ) {}

  async run(
    args: AmazonBackfillArgs,
    onProgress?: BackfillProgress,
  ): Promise<{ processed: number; total: number }> {
    const nodes = args.accessToken.startsWith("dev_")
      ? generateAmazonSynthetic(args.resource, args.shopId)
      : await this.connector.fetchResource(
          args.resource,
          args.accessToken,
          args.shopId,
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
          await this.ingestion.upsertOrder(args.channelId, normalizeAmazonOrder(n));
          await tick();
        }
        break;
      case "products":
        for (const n of nodes) {
          await this.ingestion.upsertProduct(
            args.channelId,
            normalizeAmazonListing(n),
          );
          await tick();
        }
        break;
      case "customers":
        for (const n of nodes) {
          await this.ingestion.upsertCustomer(args.channelId, normalizeAmazonBuyer(n));
          await tick();
        }
        break;
    }

    this.logger.log(`Amazon backfill ${args.resource}: ${processed}/${total} (${args.shopId})`);
    return { processed, total };
  }
}
