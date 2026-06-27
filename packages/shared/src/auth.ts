import { z } from "zod";
import type { PlanEntitlement } from "./billing.js";

// ---------------------------------------------------------------------------
// İstek (request) şemaları — hem API (ZodValidationPipe) hem web (react-hook-form)
// ---------------------------------------------------------------------------

export const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(200),
  /** Açılışta oluşturulacak ilk mağazanın adı (opsiyonel). */
  storeName: z.string().min(1).max(200).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Aktif mağazayı (store) değiştir. */
export const switchStoreSchema = z.object({
  storeId: z.string().uuid(),
});
export type SwitchStoreInput = z.infer<typeof switchStoreSchema>;

/** Yeni mağaza oluştur / yeniden adlandır. */
export const storeNameSchema = z.object({
  name: z.string().min(1).max(200),
});
export type StoreNameInput = z.infer<typeof storeNameSchema>;

// ---------------------------------------------------------------------------
// Yanıt (response) sözleşmeleri
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

/** Kullanıcıya ait bir mağaza (üst grup; kanalları kapsar). */
export interface StoreView {
  id: string;
  name: string;
  slug: string;
}

export interface SessionResponse {
  accessToken: string;
  user: AuthUser;
  activeStore: StoreView | null;
}

export interface MeResponse {
  user: AuthUser;
  stores: StoreView[];
  /** Efektif plan + özellik/limitler + kullanım (frontend gating için). */
  entitlement: PlanEntitlement;
}

export interface SwitchStoreResponse {
  accessToken: string;
  activeStore: StoreView;
}
