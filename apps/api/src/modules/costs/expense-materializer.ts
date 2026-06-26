/**
 * Özel giderleri gün+mağaza seviyesine indirgeyen saf (DB'siz) yardımcılar.
 * Yinelenen giderler günlük tutara **amortize** edilir (haftalık/7, aylık/ayın gün
 * sayısı) — böylece günlük P&L pürüzsüz olur. Tek seferlik gider yalnız başlangıç
 * gününe yazılır.
 */

import type {
  ExpenseAllocation,
  ExpenseRecurrence,
  ExpenseType,
} from "@churnify/shared";

export interface MaterializableExpense {
  type: ExpenseType;
  recurrence: ExpenseRecurrence | null;
  allocation: ExpenseAllocation;
  amount: string;
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
}

export interface AllocationRow {
  channelId: string;
  date: string; // YYYY-MM-DD
  amount: string; // 4-ondalık string
}

/** "YYYY-MM-DD" → UTC gün indeksi (timezone kaymasını önler). */
function toUtcDays(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!) / 86_400_000);
}

function fromUtcDays(days: number): string {
  return new Date(days * 86_400_000).toISOString().slice(0, 10);
}

export function daysInMonth(iso: string): number {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

/** [from, to] (dahil) tarih aralığını ISO gün dizisine açar. */
export function enumerateDays(from: string, to: string): string[] {
  const start = toUtcDays(from);
  const end = toUtcDays(to);
  const out: string[] = [];
  for (let d = start; d <= end; d++) out.push(fromUtcDays(d));
  return out;
}

/** Giderin verilen gündeki amortize edilmiş günlük tutarı (uygulanmazsa 0). */
export function computeDailyAmount(
  expense: MaterializableExpense,
  iso: string,
): number {
  const day = toUtcDays(iso);
  if (day < toUtcDays(expense.startDate)) return 0;
  if (expense.endDate && day > toUtcDays(expense.endDate)) return 0;

  const amount = Number(expense.amount);
  if (!Number.isFinite(amount)) return 0;

  if (expense.type === "one_time") {
    return iso === expense.startDate ? amount : 0;
  }
  switch (expense.recurrence) {
    case "daily":
      return amount;
    case "weekly":
      return amount / 7;
    case "monthly":
      return amount / daysInMonth(iso);
    default:
      return 0;
  }
}

/**
 * Gideri [from, to] aralığında hedef mağazalara yayar.
 * `storeIds` çağıran tarafça verilir: allocation=store → [channelId];
 * allocation=spread → org'un aktif mağazaları (günlük tutar eşit bölünür).
 * Tutarı 0 olan günler atlanır.
 */
export function buildAllocations(
  expense: MaterializableExpense,
  from: string,
  to: string,
  storeIds: string[],
): AllocationRow[] {
  if (storeIds.length === 0) return [];
  const rows: AllocationRow[] = [];
  for (const date of enumerateDays(from, to)) {
    const daily = computeDailyAmount(expense, date);
    if (daily <= 0) continue;
    const perStore = daily / storeIds.length;
    if (perStore <= 0) continue;
    const amount = perStore.toFixed(4);
    for (const channelId of storeIds) rows.push({ channelId, date, amount });
  }
  return rows;
}
