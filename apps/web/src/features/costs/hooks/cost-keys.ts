/** Costs feature'ı için query key fabrikası. */
export const costKeys = {
  cogs: (storeId: string) => ["cogs", storeId] as const,
  shipping: (storeId: string) => ["shipping", storeId] as const,
  paymentFees: (storeId: string) => ["payment-fees", storeId] as const,
  tax: (storeId: string) => ["tax", storeId] as const,
  expenses: () => ["expenses"] as const,
  // Mağaza listesi birden çok feature tarafından kullanılır; ortak anahtar.
  stores: () => ["stores"] as const,
};
