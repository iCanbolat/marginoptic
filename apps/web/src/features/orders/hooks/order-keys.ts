import type { OrdersParams } from "../types/order-types";

/** Orders feature'ı için query key fabrikası. */
export const orderKeys = {
  all: ["orders"] as const,
  list: (storeId: string | null, params: OrdersParams) =>
    [...orderKeys.all, storeId, params] as const,
  // Mağaza listesi birden çok feature tarafından kullanılır; ortak anahtar.
  stores: () => ["stores"] as const,
};
