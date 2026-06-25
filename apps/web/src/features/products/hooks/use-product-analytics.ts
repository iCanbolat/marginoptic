import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { AnalyticsFilterParams } from "@/lib/api";
import { productsApi, type ProductTableParams } from "../api/products-api";
import { productKeys } from "./product-keys";

const STALE = 60_000;

/** Overview: 4 kart (org-kapsamlı, Etsy hariç). */
export function useProductOverview(f: AnalyticsFilterParams, enabled = true) {
  return useQuery({
    queryKey: productKeys.overview(f),
    queryFn: () => productsApi.overview(f),
    enabled,
    staleTime: STALE,
  });
}

/** Ürün tablosu (sayfalı/sıralı/filtreli). */
export function useProductTable(p: ProductTableParams, enabled = true) {
  return useQuery({
    queryKey: productKeys.table(p),
    queryFn: () => productsApi.table(p),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: STALE,
  });
}
