import type { EtsySyncResource } from "../../sync/sync.constants";

type Json = Record<string, unknown>;

/** Mağaza adından deterministik taban (aynı shop → aynı id'ler → idempotent upsert). */
function seed(shop: string): number {
  let h = 0;
  for (const ch of shop) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return 200000 + h * 100;
}

const LISTING_COUNT = 5;
const BUYER_COUNT = 4;
const RECEIPT_COUNT = 8;

/** Etsy Money objesi (amount tamsayı, divisor 100). */
const money = (n: number, currency = "USD"): Json => ({
  amount: Math.round(n * 100),
  divisor: 100,
  currency_code: currency,
});

/** ISO yok — Etsy unix saniye kullanır. */
const unix = (iso: string): number => Math.floor(new Date(iso).getTime() / 1000);

function syntheticListings(shop: string): Json[] {
  const base = seed(shop);
  return Array.from({ length: LISTING_COUNT }, (_, i) => ({
    listing_id: base + i,
    title: `Etsy El Yapımı Ürün ${i + 1}`,
    url: `https://www.etsy.com/listing/${base + i}`,
    state: "active",
    taxonomy_id: 1000 + i,
    quantity: 50 - i * 5,
    price: money(24.99 + i * 6),
    skus: [`ETSY-SKU-${i + 1}`],
    created_timestamp: unix("2025-01-01T00:00:00Z"),
    updated_timestamp: unix("2025-06-01T00:00:00Z"),
  }));
}

function syntheticBuyers(shop: string): Json[] {
  const base = seed(shop) + 5000;
  return Array.from({ length: BUYER_COUNT }, (_, i) => ({
    user_id: base + i,
    primary_email: `etsybuyer${i + 1}@example.com`,
    first_name: "Etsy",
    last_name: `Alıcı ${i + 1}`,
    orders_count: i + 1,
    total_spent: money(60 + i * 35),
    create_timestamp: unix("2025-01-05T00:00:00Z"),
    update_timestamp: unix("2025-06-10T00:00:00Z"),
  }));
}

function syntheticReceipts(shop: string): Json[] {
  const lbase = seed(shop);
  const bbase = seed(shop) + 5000;
  const rbase = seed(shop) + 9000;
  return Array.from({ length: RECEIPT_COUNT }, (_, i) => {
    const rid = rbase + i;
    const listingIdx = i % LISTING_COUNT;
    const listingId = lbase + listingIdx;
    const qty = (i % 3) + 1;
    const unit = 24.99 + listingIdx * 6;
    const discount = i % 4 === 0 ? 5 : 0;
    const subtotal = unit * qty - discount;
    const tax = subtotal * 0.08;
    const shipping = 5.5;
    const grand = subtotal + tax + shipping;
    const day = String((i % 27) + 1).padStart(2, "0");
    const ts = unix(`2025-05-${day}T12:00:00Z`);
    const isRefunded = i % 5 === 0;

    return {
      receipt_id: rid,
      name: `Etsy Sipariş ${1000 + i}`,
      buyer_email: `etsybuyer${(i % BUYER_COUNT) + 1}@example.com`,
      buyer_user_id: bbase + (i % BUYER_COUNT),
      status: isRefunded ? "Refunded" : "Completed",
      is_paid: true,
      is_shipped: true,
      grandtotal: money(grand),
      subtotal: money(subtotal),
      total_price: money(grand),
      total_tax_cost: money(tax),
      total_shipping_cost: money(shipping),
      discount_amt: money(discount),
      payment_fee: money(grand * 0.03 + 0.25),
      create_timestamp: ts,
      update_timestamp: ts,
      transactions: [
        {
          transaction_id: rid * 10 + 1,
          listing_id: listingId,
          product_id: Number(`${listingId}0`),
          sku: `ETSY-SKU-${listingIdx + 1}`,
          title: `Etsy El Yapımı Ürün ${listingIdx + 1}`,
          quantity: qty,
          price: money(unit),
        },
      ],
      refunds: isRefunded
        ? [
            {
              refund_id: rid * 100 + 1,
              amount: money(grand),
              reason: "buyer_cancel",
              note_from_issuer: "Demo Etsy iade",
              created_timestamp: ts,
            },
          ]
        : [],
    };
  });
}

/**
 * Dev bağlantıları (`dev_` token) için gerçek Etsy Open API v3 yerine deterministik,
 * API-şekilli demo veri üretir — tüm hat (normalize → upsert → rollup) doğrulanır.
 */
export function generateEtsySynthetic(resource: EtsySyncResource, shop: string): Json[] {
  switch (resource) {
    case "orders":
      return syntheticReceipts(shop);
    case "products":
      return syntheticListings(shop);
    case "customers":
      return syntheticBuyers(shop);
  }
}
