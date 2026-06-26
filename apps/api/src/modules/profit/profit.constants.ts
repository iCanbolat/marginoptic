export const QUEUE_METRICS_ROLLUP = "metrics-rollup";
export const QUEUE_FX_RATES = "fx-rates";

/** Backfill/sync sonrası rollup zincirini kuran FlowProducer (sync modülünde). */
export const METRICS_FLOW_PRODUCER = "metrics-flow";

/** Gece tam rollup repeatable job kimliği. */
export const METRICS_ROLLUP_SCHEDULER = "metrics-rollup-nightly";
/** Günlük FX güncelleme repeatable job kimliği. */
export const FX_RATES_SCHEDULER = "fx-rates-daily";

/**
 * Rollup job verisi.
 * - `channelId` dolu + `from`/`to` yok → o mağazayı tam yeniden hesapla (sync sonrası).
 * - `channelId` + `from`/`to` → yalnız o aralığı yeniden hesapla (webhook artımlı).
 * - Boş → gece scheduler: tüm aktif mağazaları tam yeniden hesapla.
 */
export interface MetricsRollupJob {
  channelId?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}
