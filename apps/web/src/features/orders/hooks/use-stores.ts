import { useQuery } from "@tanstack/react-query";
import { ordersApi } from "../api/orders-api";
import { orderKeys } from "./order-keys";

/** Mağaza listesi (aktif mağaza seçimi / fallback için). */
export function useStores() {
  return useQuery({
    queryKey: orderKeys.stores(),
    queryFn: ordersApi.listStores,
  });
}
