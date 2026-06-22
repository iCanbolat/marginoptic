import { Injectable, Logger } from "@nestjs/common";
import { parseJsonl, reconstructBulkObjects } from "./bulk-jsonl";
import {
  BULK_CHILD_FIELDS,
  BULK_RUN_MUTATION,
  CURRENT_BULK_QUERY,
  bulkQueryFor,
} from "./shopify-queries";
import { ShopifyGraphqlClient } from "./shopify-graphql.client";
import type { ShopifySyncResource } from "../../sync/sync.constants";

type Json = Record<string, unknown>;

interface CurrentBulkOperation {
  id: string;
  status: string;
  errorCode: string | null;
  objectCount: string;
  url: string | null;
}

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 dk

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Shopify Bulk Operations ile tarihsel veri çeker: sorguyu başlatır, tamamlanana
 * kadar `currentBulkOperation`'ı yoklar, JSONL'i indirip iç içe düğümlere çevirir.
 * Mağaza başına aynı anda tek bulk operasyon çalışabildiği için başlatmadan önce
 * çalışan operasyonun bitmesini bekler.
 */
@Injectable()
export class ShopifyBulkService {
  private readonly logger = new Logger(ShopifyBulkService.name);

  constructor(private readonly gql: ShopifyGraphqlClient) {}

  async fetchResource(
    shop: string,
    accessToken: string,
    resource: ShopifySyncResource,
    filter?: string,
  ): Promise<Json[]> {
    await this.waitForIdle(shop, accessToken);

    const started = await this.gql.query<{
      bulkOperationRunQuery: {
        bulkOperation: { id: string; status: string } | null;
        userErrors: { field: string[]; message: string }[];
      };
    }>(shop, accessToken, BULK_RUN_MUTATION, {
      query: bulkQueryFor(resource, filter),
    });

    const errors = started.bulkOperationRunQuery.userErrors;
    if (errors.length > 0) {
      throw new Error(
        `Bulk başlatılamadı (${resource}): ${errors.map((e) => e.message).join("; ")}`,
      );
    }

    const op = await this.poll(shop, accessToken);
    if (op.status !== "COMPLETED") {
      throw new Error(
        `Bulk tamamlanmadı (${resource}): ${op.status} ${op.errorCode ?? ""}`.trim(),
      );
    }
    if (!op.url) return []; // 0 sonuç

    const res = await fetch(op.url);
    if (!res.ok) throw new Error(`Bulk JSONL indirilemedi (HTTP ${res.status})`);
    const lines = parseJsonl(await res.text());
    return reconstructBulkObjects(lines, BULK_CHILD_FIELDS[resource]);
  }

  private async current(
    shop: string,
    accessToken: string,
  ): Promise<CurrentBulkOperation | null> {
    const data = await this.gql.query<{
      currentBulkOperation: CurrentBulkOperation | null;
    }>(shop, accessToken, CURRENT_BULK_QUERY);
    return data.currentBulkOperation;
  }

  private async waitForIdle(shop: string, accessToken: string): Promise<void> {
    const op = await this.current(shop, accessToken);
    if (op && (op.status === "RUNNING" || op.status === "CREATED")) {
      this.logger.warn(`${shop}: önceki bulk operasyon bekleniyor (${op.status})`);
      await this.poll(shop, accessToken);
    }
  }

  private async poll(
    shop: string,
    accessToken: string,
  ): Promise<CurrentBulkOperation> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    for (;;) {
      const op = await this.current(shop, accessToken);
      if (!op) throw new Error("currentBulkOperation boş");
      if (op.status !== "RUNNING" && op.status !== "CREATED") return op;
      if (Date.now() > deadline) throw new Error("Bulk operasyon zaman aşımı");
      await sleep(POLL_INTERVAL_MS);
    }
  }
}
