import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { AD_PROVIDERS, type AdProvider } from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { integrationConnections } from "../../database/schema/stores";
import { SyncService } from "../sync/sync.service";
import {
  ADS_BACKFILL_DAYS,
  ADS_INCREMENTAL_DAYS,
  ADS_RESOURCE,
  QUEUE_ADS_SYNC,
  type AdsSyncJob,
} from "./ads.constants";

function isoOffset(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/** Reklam senkron işlerini kuyruğa alır (bağlanınca backfill + günlük artımlı). */
@Injectable()
export class AdsSyncService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectQueue(QUEUE_ADS_SYNC) private readonly queue: Queue<AdsSyncJob>,
    private readonly sync: SyncService,
  ) {}

  /** Bağlanma sonrası ilk backfill (geçmiş `ADS_BACKFILL_DAYS` gün). */
  async enqueueBackfill(args: {
    connectionId: string;
    storeId: string;
    provider: AdProvider;
    externalAccountId: string;
  }): Promise<void> {
    const since = isoOffset(-ADS_BACKFILL_DAYS);
    const until = isoOffset(0);
    await this.sync.setSyncState(args.connectionId, ADS_RESOURCE, "queued");
    await this.queue.add("ads-backfill", { ...args, since, until });
  }

  /** Günlük scheduler: tüm aktif reklam bağlantılarını artımlı senkronla. */
  async enqueueAllActive(): Promise<number> {
    const rows = await this.db
      .select({
        id: integrationConnections.id,
        storeId: integrationConnections.storeId,
        provider: integrationConnections.provider,
        externalAccountId: integrationConnections.externalAccountId,
      })
      .from(integrationConnections)
      .where(
        and(
          inArray(integrationConnections.provider, [...AD_PROVIDERS]),
          eq(integrationConnections.status, "active"),
          isNotNull(integrationConnections.storeId),
        ),
      );

    const since = isoOffset(-ADS_INCREMENTAL_DAYS);
    const until = isoOffset(0);
    for (const r of rows) {
      await this.sync.setSyncState(r.id, ADS_RESOURCE, "queued");
      await this.queue.add("ads-incremental", {
        connectionId: r.id,
        storeId: r.storeId!,
        provider: r.provider as AdProvider,
        externalAccountId: r.externalAccountId ?? "",
        since,
        until,
      });
    }
    return rows.length;
  }
}
