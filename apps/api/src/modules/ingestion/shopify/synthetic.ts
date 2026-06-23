import type { ShopifySyncResource } from "../../sync/sync.constants";

type Json = Record<string, unknown>;

/** Mağaza alan adından deterministik sayısal taban (aynı shop → aynı id'ler → idempotent). */
function seed(shop: string): number {
  let h = 0;
  for (const ch of shop) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return 100000 + h * 100;
}

const PRODUCT_COUNT = 14;
const CUSTOMER_COUNT = 40;
const ORDER_COUNT = 240;
/** Siparişler bugünden geriye bu kadar güne yayılır (dashboard varsayılan aralığını kapsar). */
const WINDOW_DAYS = 180;

const money = (n: number) => n.toFixed(2);

/** Demo ürün adları — gerçekçi bir katalog hissi için (idx % uzunluk ile sarar). */
const PRODUCT_NAMES = [
  "Pamuklu Tişört",
  "Deri Cüzdan",
  "Seramik Kupa",
  "Bambu Şişe",
  "El Yapımı Sabun",
  "Yün Atkı",
  "Ahşap Tepsi",
  "Cam Mum",
  "Keten Çanta",
  "Metal Anahtarlık",
  "Örme Bere",
  "Porselen Tabak",
  "Vegan Krem",
  "Çelik Termos",
];

function productName(idx: number): string {
  return PRODUCT_NAMES[idx % PRODUCT_NAMES.length];
}

function unitPrice(idx: number): number {
  return 19.99 + idx * 5;
}

/** Bugünden `offset` gün önce, öğlen UTC (deterministik gün, generation anına göre). */
function isoDaysAgo(offset: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString();
}

function syntheticProducts(shop: string): Json[] {
  const base = seed(shop);
  const createdAt = isoDaysAgo(WINDOW_DAYS + 30);
  return Array.from({ length: PRODUCT_COUNT }, (_, i) => {
    const pid = base + i;
    return {
      id: pid,
      title: productName(i),
      handle: `demo-urun-${i + 1}`,
      status: "active",
      vendor: "Churnify Demo",
      product_type: "Genel",
      created_at: createdAt,
      updated_at: isoDaysAgo(7),
      variants: [0, 1].map((v) => ({
        id: pid * 10 + v,
        product_id: pid,
        sku: `SKU-${i + 1}-${v + 1}`,
        title: v === 0 ? "Küçük" : "Büyük",
        price: money(unitPrice(i) + v * 3),
        inventory_quantity: 100 - i * 4,
        created_at: createdAt,
        updated_at: isoDaysAgo(7),
      })),
    };
  });
}

function syntheticCustomers(shop: string): Json[] {
  const base = seed(shop) + 5000;
  const createdAt = isoDaysAgo(WINDOW_DAYS + 20);
  return Array.from({ length: CUSTOMER_COUNT }, (_, i) => ({
    id: base + i,
    email: `musteri${i + 1}@example.com`,
    first_name: `Müşteri`,
    last_name: `${i + 1}`,
    orders_count: (i % 5) + 1,
    total_spent: money(50 + (i % 12) * 40),
    currency: "USD",
    created_at: createdAt,
    updated_at: isoDaysAgo(3),
  }));
}

function syntheticOrders(shop: string): Json[] {
  const pbase = seed(shop);
  const cbase = seed(shop) + 5000;
  const obase = seed(shop) + 9000;
  return Array.from({ length: ORDER_COUNT }, (_, i) => {
    const oid = obase + i;
    // Siparişleri pencereye eşit dağıt (eski → yeni), gün başına ~1-2 sipariş.
    const dayOffset = WINDOW_DAYS - 1 - Math.floor((i * WINDOW_DAYS) / ORDER_COUNT);
    const processedAt = isoDaysAgo(dayOffset);

    const lineCount = (i % 3) + 1;
    const lineItems: Json[] = [];
    let subtotal = 0;
    let totalDiscount = 0;
    for (let li = 0; li < lineCount; li++) {
      const productIdx = (i + li * 5) % PRODUCT_COUNT;
      const pid = pbase + productIdx;
      const variantIdx = (i + li) % 2;
      const variantId = pid * 10 + variantIdx;
      const qty = ((i + li) % 3) + 1;
      const unit = unitPrice(productIdx) + variantIdx * 3;
      const lineDiscount = (i + li) % 4 === 0 ? 5 : 0;
      subtotal += unit * qty - lineDiscount;
      totalDiscount += lineDiscount;
      lineItems.push({
        id: oid * 10 + li + 1,
        product_id: pid,
        variant_id: variantId,
        sku: `SKU-${productIdx + 1}-${variantIdx + 1}`,
        title: productName(productIdx),
        quantity: qty,
        price: money(unit),
        total_discount: money(lineDiscount),
      });
    }

    const tax = subtotal * 0.1;
    const shipping = 4.99;
    const total = subtotal + tax + shipping;
    const isRefunded = i % 9 === 0;

    const order: Json = {
      id: oid,
      name: `#${1000 + i}`,
      email: `musteri${(i % CUSTOMER_COUNT) + 1}@example.com`,
      customer: { id: cbase + (i % CUSTOMER_COUNT) },
      financial_status: isRefunded ? "refunded" : "paid",
      fulfillment_status: "fulfilled",
      currency: "USD",
      presentment_currency: "USD",
      subtotal_price: money(subtotal),
      total_price: money(total),
      total_discounts: money(totalDiscount),
      total_tax: money(tax),
      total_shipping_price_set: { shop_money: { amount: money(shipping) } },
      test: false,
      processed_at: processedAt,
      created_at: processedAt,
      updated_at: processedAt,
      line_items: lineItems,
      transactions: [
        {
          id: oid * 100 + 1,
          kind: "sale",
          status: "success",
          gateway: "shopify_payments",
          amount: money(total),
          fee: money(total * 0.029 + 0.3),
          currency: "USD",
          processed_at: processedAt,
        },
      ],
      refunds: isRefunded
        ? [
            {
              id: oid * 1000 + 1,
              created_at: processedAt,
              note: "Demo iade",
              transactions: [
                { id: oid * 1000 + 2, kind: "refund", amount: money(total) },
              ],
              refund_line_items: [{ total_tax: money(tax) }],
              order_adjustments: [{ amount: money(-shipping) }],
            },
          ]
        : [],
    };
    return order;
  });
}

/** Dev bağlantıları için gerçek Shopify olmadan REST-şekilli demo veri üretir. */
export function generateSynthetic(
  resource: ShopifySyncResource,
  shop: string,
): Json[] {
  switch (resource) {
    case "orders":
      return syntheticOrders(shop);
    case "products":
      return syntheticProducts(shop);
    case "customers":
      return syntheticCustomers(shop);
  }
}
