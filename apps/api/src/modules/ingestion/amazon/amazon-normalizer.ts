import type {
  NormalizedCustomer,
  NormalizedLineItem,
  NormalizedOrder,
  NormalizedProduct,
  NormalizedRefund,
  NormalizedTransaction,
} from "../ingestion.types";

/**
 * Faz 10 — Amazon SP-API JSON → sağlayıcıdan bağımsız Normalized* şekiller.
 * Saf (yan etkisiz) fonksiyonlar; `@churnify/shared` runtime import'u YOK (jest-uyumlu).
 *
 * Amazon para alanları `Money { CurrencyCode: "USD", Amount: "39.99" }` (Amount ondalık
 * string). Zaman damgaları ISO-8601 string.
 */

type Json = Record<string, unknown>;

interface AmazonMoney {
  Amount?: string | number;
  CurrencyCode?: string;
}

/** Amazon Money → ondalık string ("39.99"). */
export function amazonMoney(m: unknown): string | null {
  const money = m as AmazonMoney | null | undefined;
  if (money?.Amount == null) return null;
  const n = Number(money.Amount);
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

function currencyOf(m: unknown): string | null {
  const money = m as AmazonMoney | null | undefined;
  return money?.CurrencyCode ?? null;
}

/** ISO-8601 string → Date. */
export function amazonTs(iso: unknown): Date | null {
  if (typeof iso !== "string" || iso.length === 0) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const str = (v: unknown): string | null => (v == null ? null : String(v));
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);

/** Amazon listing item → NormalizedProduct (tek varyant: SellerSKU + fiyat + miktar). */
export function normalizeAmazonListing(item: Json): NormalizedProduct {
  const sku = str(item.sku ?? item.SellerSKU) ?? "";
  const summaries = Array.isArray(item.summaries) ? (item.summaries as Json[]) : [];
  const title =
    str(item.title) ?? str(summaries[0]?.itemName) ?? `Amazon item ${sku}`;
  const price = amazonMoney(item.price);
  const quantity = typeof item.quantity === "number" ? item.quantity : null;
  const created = amazonTs(item.created_at);
  const updated = amazonTs(item.updated_at);
  return {
    externalId: sku,
    title,
    handle: str(item.asin ?? item.ASIN),
    status: str(item.status ?? "active"),
    vendor: null,
    productType: str(item.productType),
    shopifyCreatedAt: created,
    shopifyUpdatedAt: updated,
    variants: [
      {
        externalId: `${sku}-0`,
        externalProductId: sku,
        sku,
        title,
        price,
        inventoryQuantity: quantity,
        shopifyCreatedAt: created,
        shopifyUpdatedAt: updated,
      },
    ],
  };
}

/** Amazon order item → NormalizedLineItem. */
function normalizeAmazonItem(it: Json): NormalizedLineItem {
  const qty = num(it.QuantityOrdered) || 1;
  const total = amazonMoney(it.ItemPrice);
  const unit = total != null ? (Number(total) / qty).toFixed(2) : null;
  return {
    externalId: str(it.OrderItemId) ?? "",
    productExternalId: str(it.ASIN),
    variantExternalId: str(it.SellerSKU),
    sku: str(it.SellerSKU),
    title: str(it.Title),
    quantity: qty,
    price: unit,
    discountAmount: amazonMoney(it.PromotionDiscount),
    totalAmount: total,
  };
}

/** Amazon refund → NormalizedRefund. */
function normalizeAmazonRefund(r: Json, idx: number, orderId: string): NormalizedRefund {
  return {
    externalId: str(r.RefundId) ?? `${orderId}-refund-${idx}`,
    amount: amazonMoney(r.Amount),
    shippingRefunded: null,
    taxRefunded: null,
    note: str(r.Reason),
    processedAt: amazonTs(r.RefundDate),
    shopifyCreatedAt: amazonTs(r.RefundDate),
  };
}

/** Amazon order → NormalizedOrder (satırlar + ödeme hareketi + iadeler). */
export function normalizeAmazonOrder(order: Json): NormalizedOrder {
  const id = str(order.AmazonOrderId) ?? "";
  const items = Array.isArray(order.OrderItems) ? (order.OrderItems as Json[]) : [];
  const refundList = Array.isArray(order.Refunds) ? (order.Refunds as Json[]) : [];
  const buyer = (order.BuyerInfo ?? {}) as Json;

  const total = order.OrderTotal;
  const currency = currencyOf(total) ?? "USD";
  const created = amazonTs(order.PurchaseDate);
  const updated = amazonTs(order.LastUpdateDate);
  const status = str(order.OrderStatus);
  const isPaid = status !== "Pending";
  const isFulfilled = status === "Shipped" || status === "Delivered";
  const totalRefunded = refundList.reduce(
    (sum, r) => sum + Number(amazonMoney(r.Amount) ?? 0),
    0,
  );
  const isRefunded = totalRefunded > 0;

  const transactions: NormalizedTransaction[] = [
    {
      externalId: `${id}-payment`,
      kind: "sale",
      status: isPaid ? "success" : "pending",
      gateway: "amazon_pay",
      amount: amazonMoney(total),
      // Ham Amazon ücreti Finances API'de; sentetik `MarketplaceFee` verirse onu kullanırız.
      fee: amazonMoney(order.MarketplaceFee) ?? null,
      currency,
      processedAt: created,
    },
  ];

  return {
    externalId: id,
    name: str(order.SellerOrderId) ?? `#${id}`,
    email: str(buyer.BuyerEmail),
    customerExternalId: str(buyer.BuyerEmail),
    financialStatus: isRefunded ? "refunded" : isPaid ? "paid" : "pending",
    fulfillmentStatus: isFulfilled ? "fulfilled" : "unfulfilled",
    currency,
    presentmentCurrency: currency,
    subtotalPrice: amazonMoney(order.SubtotalPrice),
    totalPrice: amazonMoney(total),
    totalDiscounts: amazonMoney(order.DiscountPrice),
    totalTax: amazonMoney(order.TaxPrice),
    totalShipping: amazonMoney(order.ShippingPrice),
    totalRefunded: isRefunded ? totalRefunded.toFixed(2) : null,
    test: false,
    processedAt: created,
    cancelledAt: status === "Canceled" ? updated : null,
    shopifyCreatedAt: created,
    shopifyUpdatedAt: updated,
    lineItems: items.map(normalizeAmazonItem),
    transactions,
    refunds: refundList.map((r, i) => normalizeAmazonRefund(r, i, id)),
  };
}

/** Amazon buyer (order'dan türetilmiş) → NormalizedCustomer. */
export function normalizeAmazonBuyer(buyer: Json): NormalizedCustomer {
  return {
    externalId: str(buyer.email) ?? "",
    email: str(buyer.email),
    firstName: str(buyer.first_name),
    lastName: str(buyer.last_name),
    ordersCount: num(buyer.orders_count),
    totalSpent: amazonMoney(buyer.total_spent) ?? str(buyer.total_spent),
    currency: currencyOf(buyer.total_spent) ?? "USD",
    shopifyCreatedAt: null,
    shopifyUpdatedAt: null,
  };
}
