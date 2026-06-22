import { z } from "zod";

/** Bir bağlantı+kaynak (orders/products/customers) için sync durumu. */
export const SYNC_STATUSES = [
  "idle",
  "queued",
  "running",
  "done",
  "error",
] as const;
export type SyncStatusValue = (typeof SYNC_STATUSES)[number];

export interface SyncResourceStatus {
  resource: string;
  status: SyncStatusValue;
  processed: number;
  total: number | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  updatedAt: string;
}

/** Bir mağazanın tüm kaynaklarının sync özeti (backfill ilerleme UI'ı bunu okur). */
export interface StoreSyncStatus {
  storeId: string;
  resources: SyncResourceStatus[];
  /** Tüm kaynaklar `done` mu? */
  complete: boolean;
  /** En güncel `lastSyncedAt` (veri tazeliği rozeti için). */
  lastSyncedAt: string | null;
}

/** Ham sipariş tablosu satırı (debug/iç görünürlük). */
export interface OrderRow {
  id: string;
  externalId: string;
  name: string | null;
  email: string | null;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  currency: string | null;
  totalPrice: string | null;
  totalRefunded: string | null;
  test: boolean;
  processedAt: string | null;
  createdAt: string;
}

/** Cursor tabanlı sayfalı yanıt. */
export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

/** Sipariş listesi sorgu parametreleri. */
export const ordersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
  financialStatus: z.string().trim().min(1).max(48).optional(),
  search: z.string().trim().min(1).max(120).optional(),
});
export type OrdersQuery = z.infer<typeof ordersQuerySchema>;
