/** Integrations feature'ı için query key fabrikası. */
export const integrationKeys = {
  all: ["integrations"] as const,
  overview: () => [...integrationKeys.all, "overview"] as const,
  // Mağaza listesi birden çok feature tarafından kullanılır; ortak anahtar.
  stores: () => ["stores"] as const,
  tracking: (storeId: string) =>
    [...integrationKeys.all, "tracking", storeId] as const,
};
