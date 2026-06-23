import type { EtsySyncResource } from "../../sync/sync.constants";

type Json = Record<string, unknown>;

/** Mağaza adından deterministik taban (aynı shop → aynı id'ler → idempotent upsert). */
function seed(shop: string): number {
  let h = 0;
  for (const ch of shop) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return 200000 + h * 100;
}

const LISTING_COUNT = 10;
const BUYER_COUNT = 25;
const RECEIPT_COUNT = 120;
/** Makbuzlar bugünden geriye bu kadar güne yayılır (dashboard varsayılan aralığını kapsar). */
const WINDOW_DAYS = 180;

const LISTING_NAMES = [
  "El Yapımı Kolye",
  "Vintage Poster",
  "Makrome Duvar Süsü",
  "Seramik Saksı",
  "Dokuma Halı",
  "Ahşap Kaşık Seti",
  "El Örgüsü Patik",
  "Doğal Taş Bileklik",
  "Keçe Oyuncak",
  "Cam Süs",
];

function listingName(idx: number): string {
  return LISTING_NAMES[idx % LISTING_NAMES.length];
}

function listingPrice(idx: number): number {
  return 24.99 + idx * 6;
}

/** Etsy Money objesi (amount tamsayı, divisor 100). */
const money = (n: number, currency = "USD"): Json => ({
  amount: Math.round(n * 100),
  divisor: 100,
  currency_code: currency,
});

/** Bugünden `offset` gün önce, Etsy unix saniye (deterministik gün, generation anına göre). */
function unixDaysAgo(offset: number): number {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offset);
  return Math.floor(d.getTime() / 1000);
}

function syntheticListings(shop: string): Json[] {
  const base = seed(shop);
  return Array.from({ length: LISTING_COUNT }, (_, i) => ({
    listing_id: base + i,
    title: listingName(i),
    url: `https://www.etsy.com/listing/${base + i}`,
    state: "active",
    taxonomy_id: 1000 + i,
    quantity: 50 - i * 3,
    price: money(listingPrice(i)),
    skus: [`ETSY-SKU-${i + 1}`],
    created_timestamp: unixDaysAgo(WINDOW_DAYS + 30),
    updated_timestamp: unixDaysAgo(7),
  }));
}

function syntheticBuyers(shop: string): Json[] {
  const base = seed(shop) + 5000;
  return Array.from({ length: BUYER_COUNT }, (_, i) => ({
    user_id: base + i,
    primary_email: `etsybuyer${i + 1}@example.com`,
    first_name: "Etsy",
    last_name: `Alıcı ${i + 1}`,
    orders_count: (i % 5) + 1,
    total_spent: money(60 + (i % 10) * 35),
    create_timestamp: unixDaysAgo(WINDOW_DAYS + 20),
    update_timestamp: unixDaysAgo(3),
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
    const unit = listingPrice(listingIdx);
    const discount = i % 4 === 0 ? 5 : 0;
    const subtotal = unit * qty - discount;
    const tax = subtotal * 0.08;
    const shipping = 5.5;
    const grand = subtotal + tax + shipping;
    const dayOffset =
      WINDOW_DAYS - 1 - Math.floor((i * WINDOW_DAYS) / RECEIPT_COUNT);
    const ts = unixDaysAgo(dayOffset);
    const isRefunded = i % 9 === 0;

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
          title: listingName(listingIdx),
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
