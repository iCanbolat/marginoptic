import type {
  OrderRow,
  OrdersParams,
  Paginated,
  StoreSummary,
} from "../types/order-types";

/**
 * Mock veri anahtarı. `.env`'e `VITE_MOCK_ORDERS=true` yazıp dev server'ı
 * yeniden başlatınca orders feature'ı API yerine bu sahte veriyi kullanır —
 * backend olmadan tablo/filtre/sayfalama akışını test etmek için.
 */
export const USE_MOCK_ORDERS = import.meta.env.VITE_MOCK_ORDERS === "true";

export const MOCK_STORES: StoreSummary[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    channel: "shopify",
    name: "Mock Mağaza",
    externalShopId: "mock-shop",
    domain: "mock.myshopify.com",
    currency: "USD",
    status: "active",
  },
];

const STATUSES = [
  "paid",
  "pending",
  "refunded",
  "partially_refunded",
  "voided",
] as const;

const FIRST_NAMES = [
  "ada",
  "berk",
  "cem",
  "deniz",
  "ela",
  "ferit",
  "gizem",
  "hakan",
  "irem",
  "jale",
];

/** Deterministik ~57 sahte sipariş (her render aynı veri). */
const MOCK_ORDERS: OrderRow[] = Array.from({ length: 57 }, (_, i) => {
  const status = STATUSES[i % STATUSES.length];
  const total = (29 + (i * 37) % 470) + 0.99;
  const refunded =
    status === "refunded"
      ? total
      : status === "partially_refunded"
        ? Math.round(total * 0.4 * 100) / 100
        : 0;
  const created = new Date(2026, 5, 23, 9, 0, 0);
  created.setMinutes(created.getMinutes() - i * 137);
  const name = FIRST_NAMES[i % FIRST_NAMES.length];
  return {
    id: `mock-${i + 1}`,
    externalId: String(4500 + i),
    name: `#${1001 + i}`,
    email: `${name}${i}@example.com`,
    financialStatus: status,
    fulfillmentStatus: i % 3 === 0 ? "fulfilled" : "unfulfilled",
    currency: "USD",
    totalPrice: total.toFixed(2),
    totalRefunded: refunded.toFixed(2),
    test: i % 11 === 0,
    processedAt: created.toISOString(),
    createdAt: created.toISOString(),
  };
});

/** API ile aynı sözleşmeyi taklit eder: filtre + offset (sayfa) sayfalama + toplam. */
export function mockListOrders(params: OrdersParams = {}): Paginated<OrderRow> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const search = params.search?.toLowerCase();

  const filtered = MOCK_ORDERS.filter((o) => {
    if (params.financialStatus && o.financialStatus !== params.financialStatus) {
      return false;
    }
    if (search) {
      const hay = `${o.name ?? ""} ${o.email ?? ""} ${o.externalId}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const offset = (page - 1) * pageSize;
  return {
    items: filtered.slice(offset, offset + pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}
