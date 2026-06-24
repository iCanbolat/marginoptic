import type { AmazonSyncResource } from "../../sync/sync.constants";

type Json = Record<string, unknown>;

/** Satıcı adından deterministik taban (aynı shop → aynı id'ler → idempotent upsert). */
function seed(shop: string): number {
  let h = 0;
  for (const ch of shop) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return 400000 + h * 100;
}

const ITEM_COUNT = 10;
const BUYER_COUNT = 25;
const ORDER_COUNT = 120;
/** Siparişler bugünden geriye bu kadar güne yayılır (dashboard varsayılan aralığını kapsar). */
const WINDOW_DAYS = 180;

const ITEM_NAMES = [
  "Kablosuz Şarj Cihazı",
  "Akıllı Saat Kordonu",
  "USB-C Hub",
  "Laptop Standı",
  "Mekanik Fare",
  "Webcam HD",
  "Masaüstü Lamba",
  "Termos Şişe",
  "Sırt Çantası",
  "Kitap Standı",
];

function itemName(idx: number): string {
  return ITEM_NAMES[idx % ITEM_NAMES.length];
}

function itemPrice(idx: number): number {
  return 34.99 + idx * 8;
}

/** Amazon Money objesi (Amount ondalık string). */
const money = (n: number, currency = "USD"): Json => ({
  CurrencyCode: currency,
  Amount: n.toFixed(2),
});

/** Bugünden `offset` gün önce, ISO-8601 (deterministik gün, generation anına göre). */
function isoDaysAgo(offset: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString();
}

function syntheticListings(shop: string): Json[] {
  const base = seed(shop);
  return Array.from({ length: ITEM_COUNT }, (_, i) => ({
    sku: `AMZ-SKU-${base + i}`,
    asin: `B${base + i}`,
    status: "active",
    title: itemName(i),
    productType: "PRODUCT",
    price: money(itemPrice(i)),
    quantity: 50 - i * 3,
    created_at: isoDaysAgo(WINDOW_DAYS + 30),
    updated_at: isoDaysAgo(7),
  }));
}

function syntheticBuyers(shop: string): Json[] {
  return Array.from({ length: BUYER_COUNT }, (_, i) => ({
    email: `amzbuyer${i + 1}@example.com`,
    first_name: "Amazon",
    last_name: `Alıcı ${i + 1}`,
    orders_count: (i % 5) + 1,
    total_spent: money(100 + (i % 10) * 45),
  }));
}

function syntheticOrders(shop: string): Json[] {
  const sbase = seed(shop);
  const obase = seed(shop) + 9000;
  return Array.from({ length: ORDER_COUNT }, (_, i) => {
    const oid = obase + i;
    const itemIdx = i % ITEM_COUNT;
    const sku = `AMZ-SKU-${sbase + itemIdx}`;
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
      AmazonOrderId: `${oid}-AMZ`,
      SellerOrderId: String(1000 + i),
      PurchaseDate: ts,
      LastUpdateDate: ts,
      OrderStatus: "Shipped",
      OrderTotal: money(grand),
      SubtotalPrice: money(subtotal),
      DiscountPrice: money(discount),
      TaxPrice: money(tax),
      ShippingPrice: money(shipping),
      MarketplaceFee: money(grand * 0.15 + 0.99),
      BuyerInfo: { BuyerEmail: `amzbuyer${buyerIdx + 1}@example.com` },
      NumberOfItemsShipped: qty,
      OrderItems: [
        {
          OrderItemId: `${oid}-1`,
          ASIN: `B${sbase + itemIdx}`,
          SellerSKU: sku,
          Title: itemName(itemIdx),
          QuantityOrdered: qty,
          ItemPrice: money(unit * qty),
          PromotionDiscount: money(discount),
        },
      ],
      Refunds: isRefunded
        ? [
            {
              RefundId: `${oid}-R1`,
              Amount: money(grand),
              Reason: "Demo Amazon iade",
              RefundDate: ts,
            },
          ]
        : [],
    };
  });
}

/**
 * Dev bağlantıları (`dev_` token) için gerçek Amazon SP-API yerine deterministik,
 * API-şekilli demo veri üretir — tüm hat (normalize → upsert → rollup) doğrulanır.
 */
export function generateAmazonSynthetic(
  resource: AmazonSyncResource,
  shop: string,
): Json[] {
  switch (resource) {
    case "orders":
      return syntheticOrders(shop);
    case "products":
      return syntheticListings(shop);
    case "customers":
      return syntheticBuyers(shop);
  }
}
