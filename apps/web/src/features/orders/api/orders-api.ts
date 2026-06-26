import { apiGet } from "@/lib/api-client";
import type { OrderRow, OrdersParams, Paginated, ChannelSummary } from "../types/order-types";

/** Orders DAL — saf axios çağrıları (mağaza-scoped siparişler). */
export const ordersApi = {
  list: (storeId: string, params: OrdersParams = {}): Promise<Paginated<OrderRow>> =>
    // axios `params`'taki undefined değerleri otomatik atar.
    apiGet<Paginated<OrderRow>>(`/channels/${storeId}/orders`, {
      params: {
        page: params.page,
        pageSize: params.pageSize,
        financialStatus: params.financialStatus,
        search: params.search,
      },
    }),

  listStores: (): Promise<ChannelSummary[]> => apiGet<ChannelSummary[]>("/channels"),
};
