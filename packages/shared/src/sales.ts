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

/** Offset tabanlı sayfalı yanıt (toplam sayım ile — "Sayfa X / Y" için). */
export interface Paginated<T> {
  items: T[];
  /** Filtre uygulanmış toplam kayıt sayısı. */
  total: number;
  /** 1-tabanlı aktif sayfa. */
  page: number;
  pageSize: number;
}

/** Sipariş listesi sorgu parametreleri (offset/sayfa tabanlı). */
export const ordersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  financialStatus: z.string().trim().min(1).max(48).optional(),
  search: z.string().trim().min(1).max(120).optional(),
});
export type OrdersQuery = z.infer<typeof ordersQuerySchema>;
