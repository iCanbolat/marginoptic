export const QUEUE_RECURRING_EXPENSES = "recurring-expenses";

/** Günlük materialize için repeatable job scheduler kimliği. */
export const RECURRING_EXPENSES_SCHEDULER = "recurring-expenses-daily";

/**
 * Materialize job verisi.
 * - `customExpenseId` dolu → tek gideri [from, to] aralığında yeniden materialize et
 *   (oluşturma/güncelleme sonrası).
 * - Boş → günlük scheduler: tüm aktif giderleri dünden bugüne materialize et.
 */
export interface MaterializeExpenseJob {
  customExpenseId?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}
