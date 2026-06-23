import { apiGet } from "@/lib/api-client";
import type { OrderRow, OrdersParams, Paginated, StoreSummary } from "../types/order-types";
import { MOCK_STORES, USE_MOCK_ORDERS, mockListOrders } from "../mocks/orders-mock";

/**
 * Orders DAL — saf axios çağrıları. `VITE_MOCK_ORDERS=true` ise API yerine
 * mock veri döner (bkz. `mocks/orders-mock.ts`).
 */
export const ordersApi = {
  list: (storeId: string, params: OrdersParams = {}): Promise<Paginated<OrderRow>> => {
    if (USE_MOCK_ORDERS) return Promise.resolve(mockListOrders(params));
    // axios `params`'taki undefined değerleri otomatik atar.
    return apiGet<Paginated<OrderRow>>(`/stores/${storeId}/orders`, {
      params: {
        page: params.page,
        pageSize: params.pageSize,
        financialStatus: params.financialStatus,
        search: params.search,
      },
    });
  },

  listStores: (): Promise<StoreSummary[]> => {
    if (USE_MOCK_ORDERS) return Promise.resolve(MOCK_STORES);
    return apiGet<StoreSummary[]>("/stores");
  },
};
