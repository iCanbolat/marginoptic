import type { ShopifySyncResource } from "../../sync/sync.constants";

type Json = Record<string, unknown>;

/** Mağaza alan adından deterministik sayısal taban (aynı shop → aynı id'ler → idempotent). */
function seed(shop: string): number {
  let h = 0;
  for (const ch of shop) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return 100000 + h * 100;
}

const PRODUCT_COUNT = 5;
const CUSTOMER_COUNT = 4;
const ORDER_COUNT = 8;
const money = (n: number) => n.toFixed(2);

function syntheticProducts(shop: string): Json[] {
  const base = seed(shop);
  return Array.from({ length: PRODUCT_COUNT }, (_, i) => {
    const pid = base + i;
    return {
      id: pid,
      title: `Demo Ürün ${i + 1}`,
      handle: `demo-urun-${i + 1}`,
      status: "active",
      vendor: "Churnify Demo",
      product_type: "Genel",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-06-01T00:00:00Z",
      variants: [0, 1].map((v) => ({
        id: pid * 10 + v,
        product_id: pid,
        sku: `SKU-${i + 1}-${v + 1}`,
        title: v === 0 ? "Küçük" : "Büyük",
        price: money(19.99 + i * 5 + v * 3),
        inventory_quantity: 100 - i * 7,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-06-01T00:00:00Z",
      })),
    };
  });
}

function syntheticCustomers(shop: string): Json[] {
  const base = seed(shop) + 5000;
  return Array.from({ length: CUSTOMER_COUNT }, (_, i) => ({
    id: base + i,
    email: `musteri${i + 1}@example.com`,
    first_name: `Müşteri`,
    last_name: `${i + 1}`,
    orders_count: i + 1,
    total_spent: money(50 + i * 40),
    currency: "USD",
    created_at: "2025-01-05T00:00:00Z",
    updated_at: "2025-06-10T00:00:00Z",
  }));
}

function syntheticOrders(shop: string): Json[] {
  const pbase = seed(shop);
  const cbase = seed(shop) + 5000;
  const obase = seed(shop) + 9000;
  return Array.from({ length: ORDER_COUNT }, (_, i) => {
    const oid = obase + i;
    const productIdx = i % PRODUCT_COUNT;
    const pid = pbase + productIdx;
    const variantId = pid * 10 + (i % 2);
    const qty = (i % 3) + 1;
    const unit = 19.99 + productIdx * 5;
    const lineDiscount = i % 4 === 0 ? 5 : 0;
    const subtotal = unit * qty - lineDiscount;
    const tax = subtotal * 0.1;
    const shipping = 4.99;
    const total = subtotal + tax + shipping;
    const day = String((i % 27) + 1).padStart(2, "0");
    const processedAt = `2025-05-${day}T12:00:00Z`;

    const order: Json = {
      id: oid,
      name: `#${1000 + i}`,
      email: `musteri${(i % CUSTOMER_COUNT) + 1}@example.com`,
      customer: { id: cbase + (i % CUSTOMER_COUNT) },
      financial_status: i % 5 === 0 ? "refunded" : "paid",
      fulfillment_status: "fulfilled",
      currency: "USD",
      presentment_currency: "USD",
      subtotal_price: money(subtotal),
      total_price: money(total),
      total_discounts: money(lineDiscount),
      total_tax: money(tax),
      total_shipping_price_set: { shop_money: { amount: money(shipping) } },
      test: false,
      processed_at: processedAt,
      created_at: processedAt,
      updated_at: processedAt,
      line_items: [
        {
          id: oid * 10 + 1,
          product_id: pid,
          variant_id: variantId,
          sku: `SKU-${productIdx + 1}-${(i % 2) + 1}`,
          title: `Demo Ürün ${productIdx + 1}`,
          quantity: qty,
          price: money(unit),
          total_discount: money(lineDiscount),
        },
      ],
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
      refunds:
        i % 5 === 0
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
