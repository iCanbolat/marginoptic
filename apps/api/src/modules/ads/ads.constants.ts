import type { AdProvider } from "@churnify/shared";

export const QUEUE_ADS_SYNC = "ads-sync";

/** Günlük artımlı reklam senkron repeatable job kimliği. */
export const ADS_SYNC_SCHEDULER = "ads-sync-daily";

/** sync_state'te reklam bağlantısı için kaynak adı. */
export const ADS_RESOURCE = "ads";

/** Backfill penceresi (gün); canlı çekimde kullanılır (dev sentetik yok sayar). */
export const ADS_BACKFILL_DAYS = 30;
export const ADS_INCREMENTAL_DAYS = 3;

/**
 * Reklam senkron job verisi.
 * - `connectionId` dolu → o bağlantıyı [since, until] aralığında senkronla.
 * - Boş → günlük scheduler: tüm aktif reklam bağlantılarını kuyruğa al.
 */
export interface AdsSyncJob {
  connectionId?: string;
  channelId?: string;
  provider?: AdProvider;
  externalAccountId?: string;
  since?: string; // YYYY-MM-DD
  until?: string; // YYYY-MM-DD
}
