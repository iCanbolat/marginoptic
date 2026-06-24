import type { EbaySyncResource } from "../../sync/sync.constants";

type Json = Record<string, unknown>;

/** Mağaza adından deterministik taban (aynı shop → aynı id'ler → idempotent upsert). */
function seed(shop: string): number {
  let h = 0;
  for (const ch of shop) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return 300000 + h * 100;
}

const ITEM_COUNT = 10;
const BUYER_COUNT = 25;
const ORDER_COUNT = 120;
/** Siparişler bugünden geriye bu kadar güne yayılır (dashboard varsayılan aralığını kapsar). */
const WINDOW_DAYS = 180;

const ITEM_NAMES = [
  "Retro Kol Saati",
  "Koleksiyon Plak",
  "Vintage Kamera",
  "Model Araba",
  "Antika Madeni Para",
  "Spor Ayakkabı",
  "Telefon Kılıfı",
  "Bluetooth Kulaklık",
  "Mekanik Klavye",
  "Power Bank",
];

function itemName(idx: number): string {
  return ITEM_NAMES[idx % ITEM_NAMES.length];
}

function itemPrice(idx: number): number {
  return 29.99 + idx * 7;
}

/** eBay Amount objesi (value ondalık string). */
const money = (n: number, currency = "USD"): Json => ({
  value: n.toFixed(2),
  currency,
});

/** Bugünden `offset` gün önce, ISO-8601 (deterministik gün, generation anına göre). */
function isoDaysAgo(offset: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString();
}

function syntheticInventoryItems(shop: string): Json[] {
  const base = seed(shop);
  return Array.from({ length: ITEM_COUNT }, (_, i) => ({
    sku: `EBAY-SKU-${base + i}`,
    status: "active",
    product: { title: itemName(i), categoryId: String(2000 + i) },
    availability: { shipToLocationAvailability: { quantity: 50 - i * 3 } },
    price: money(itemPrice(i)),
    created_at: isoDaysAgo(WINDOW_DAYS + 30),
    updated_at: isoDaysAgo(7),
  }));
}

function syntheticBuyers(shop: string): Json[] {
  const base = seed(shop) + 5000;
  return Array.from({ length: BUYER_COUNT }, (_, i) => ({
    username: `ebaybuyer_${base + i}`,
    email: `ebaybuyer${i + 1}@example.com`,
    first_name: "eBay",
    last_name: `Alıcı ${i + 1}`,
    orders_count: (i % 5) + 1,
    total_spent: money(80 + (i % 10) * 40),
  }));
}

function syntheticOrders(shop: string): Json[] {
  const sbase = seed(shop);
  const bbase = seed(shop) + 5000;
  const obase = seed(shop) + 9000;
  return Array.from({ length: ORDER_COUNT }, (_, i) => {
    const oid = obase + i;
    const itemIdx = i % ITEM_COUNT;
    const sku = `EBAY-SKU-${sbase + itemIdx}`;
    const qty = (i % 3) + 1;
    const unit = itemPrice(itemIdx);
    const discount = i % 4 === 0 ? 5 : 0;
    const subtotal = unit * qty - discount;
    const tax = subtotal * 0.08;
    const shipping = 6.5;
    const grand = subtotal + tax + shipping;
    const dayOffset = WINDOW_DAYS - 1 - Math.floor((i * WINDOW_DAYS) / ORDER_COUNT);
    const ts = isoDaysAgo(dayOffset);
    const isRefunded = i % 9 === 0;
    const buyerIdx = i % BUYER_COUNT;

    return {
      orderId: `${oid}-EBAY`,
      legacyOrderId: String(1000 + i),
      creationDate: ts,
      lastModifiedDate: ts,
      orderFulfillmentStatus: "FULFILLED",
      orderPaymentStatus: "PAID",
      cancelStatus: "NONE_REQUESTED",
      buyer: {
        username: `ebaybuyer_${bbase + buyerIdx}`,
        buyerRegistrationAddress: { email: `ebaybuyer${buyerIdx + 1}@example.com` },
      },
      totalMarketplaceFee: money(grand * 0.1 + 0.3),
      pricingSummary: {
        priceSubtotal: money(subtotal),
        priceDiscount: money(discount),
        tax: money(tax),
        deliveryCost: money(shipping),
        total: money(grand),
      },
      lineItems: [
        {
          lineItemId: `${oid}-1`,
          legacyItemId: String(sbase + itemIdx),
          sku,
          title: itemName(itemIdx),
          quantity: qty,
          lineItemCost: money(unit),
          total: money(unit * qty),
        },
      ],
      paymentSummary: {
        refunds: isRefunded
          ? [
              {
                refundId: `${oid}-R1`,
                amount: money(grand),
                refundReferenceId: "Demo eBay iade",
                refundDate: ts,
              },
            ]
          : [],
      },
    };
  });
}

/**
 * Dev bağlantıları (`dev_` token) için gerçek eBay Sell API yerine deterministik,
 * API-şekilli demo veri üretir — tüm hat (normalize → upsert → rollup) doğrulanır.
 */
export function generateEbaySynthetic(resource: EbaySyncResource, shop: string): Json[] {
  switch (resource) {
    case "orders":
      return syntheticOrders(shop);
    case "products":
      return syntheticInventoryItems(shop);
    case "customers":
      return syntheticBuyers(shop);
  }
}
