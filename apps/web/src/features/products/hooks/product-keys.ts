import type { ProductTableParams } from "../api/products-api";

/** Ürün Analizi query key fabrikası. */
export const productKeys = {
  all: ["product-analytics"] as const,
  overview: (f: { from: string; to: string; storeIds?: string[] }) =>
    [...productKeys.all, "overview", f.from, f.to, f.storeIds ?? []] as const,
  table: (p: ProductTableParams) =>
    [
      ...productKeys.all,
      "table",
      p.from,
      p.to,
      p.storeIds ?? [],
      p.page,
      p.pageSize,
      p.sort,
      p.search ?? "",
      p.channel ?? "",
    ] as const,
  links: (storeId: string, productExternalId: string) =>
    [...productKeys.all, "links", storeId, productExternalId] as const,
  adEntities: (storeId: string, provider?: string) =>
    [...productKeys.all, "ad-entities", storeId, provider ?? "all"] as const,
  syncAll: () => [...productKeys.all, "sync-all"] as const,
};
