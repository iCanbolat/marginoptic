/** Marketplace (Amazon/eBay) traffic günlük senkron kuyruğu. */
export const QUEUE_TRAFFIC_SYNC = "traffic-sync";

/** Günlük marketplace traffic repeatable job kimliği. */
export const TRAFFIC_SYNC_SCHEDULER = "traffic-sync-daily";

/** Sentetik/canlı marketplace traffic için geriye dönük pencere (gün). */
export const TRAFFIC_WINDOW_DAYS = 30;

/** Marketplace traffic senkron job verisi (boş `storeId` → tüm aktif mağazalar). */
export interface TrafficSyncJob {
  storeId?: string;
}
