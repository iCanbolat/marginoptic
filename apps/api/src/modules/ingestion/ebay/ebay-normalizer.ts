import type {
  NormalizedCustomer,
  NormalizedLineItem,
  NormalizedOrder,
  NormalizedProduct,
  NormalizedRefund,
  NormalizedTransaction,
} from "../ingestion.types";

/**
 * Faz 10 — eBay Sell API JSON → sağlayıcıdan bağımsız Normalized* şekiller.
 * Saf (yan etkisiz) fonksiyonlar; `@churnify/shared` runtime import'u YOK (jest-uyumlu).
 *
 * eBay para alanları `Amount { value: "39.99", currency: "USD" }` (value zaten ondalık
 * string). Zaman damgaları ISO-8601 string.
 */

type Json = Record<string, unknown>;

interface EbayAmount {
  value?: string | number;
  currency?: string;
}

/** eBay Amount → ondalık string ("39.99"). */
export function ebayMoney(m: unknown): string | null {
  const amount = m as EbayAmount | null | undefined;
  if (amount?.value == null) return null;
  const n = Number(amount.value);
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

function currencyOf(m: unknown): string | null {
  const amount = m as EbayAmount | null | undefined;
  return amount?.currency ?? null;
}

/** ISO-8601 string → Date. */
export function ebayTs(iso: unknown): Date | null {
  if (typeof iso !== "string" || iso.length === 0) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const str = (v: unknown): string | null => (v == null ? null : String(v));
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);

/** eBay inventory item → NormalizedProduct (tek varyant: sku + fiyat + miktar). */
export function normalizeEbayInventoryItem(item: Json): NormalizedProduct {
  const sku = str(item.sku) ?? "";
  const product = (item.product ?? {}) as Json;
  const availability = (item.availability ?? {}) as Json;
  const shipTo = (availability.shipToLocationAvailability ?? {}) as Json;
  const quantity =
    typeof shipTo.quantity === "number"
      ? shipTo.quantity
      : typeof item.quantity === "number"
        ? item.quantity
        : null;
  const price = ebayMoney(item.price);
  const created = ebayTs(item.created_at);
  const updated = ebayTs(item.updated_at);
  return {
    externalId: sku,
    title: str(product.title) ?? `eBay item ${sku}`,
    handle: null,
    status: str(item.status ?? "active"),
    vendor: null,
    productType: str(product.categoryId),
    shopifyCreatedAt: created,
    shopifyUpdatedAt: updated,
    variants: [
      {
        externalId: `${sku}-0`,
        externalProductId: sku,
        sku,
        title: str(product.title),
        price,
        inventoryQuantity: quantity,
        shopifyCreatedAt: created,
        shopifyUpdatedAt: updated,
      },
    ],
  };
}

/** eBay lineItem → NormalizedLineItem. */
function normalizeEbayLineItem(li: Json): NormalizedLineItem {
  const qty = num(li.quantity) || 1;
  const unit = ebayMoney(li.lineItemCost);
  const total = ebayMoney(li.total) ?? (unit != null ? (Number(unit) * qty).toFixed(2) : null);
  return {
    externalId: str(li.lineItemId) ?? "",
    productExternalId: str(li.legacyItemId ?? li.sku),
    variantExternalId: str(li.sku),
    sku: str(li.sku),
    title: str(li.title),
    quantity: qty,
    price: unit,
    discountAmount: null,
    totalAmount: total,
  };
}

/** eBay refund → NormalizedRefund. */
function normalizeEbayRefund(r: Json, idx: number, orderId: string): NormalizedRefund {
  return {
    externalId: str(r.refundId) ?? `${orderId}-refund-${idx}`,
    amount: ebayMoney(r.amount),
    shippingRefunded: null,
    taxRefunded: null,
    note: str(r.refundReferenceId ?? r.reason),
    processedAt: ebayTs(r.refundDate),
    shopifyCreatedAt: ebayTs(r.refundDate),
  };
}

/** eBay order → NormalizedOrder (satırlar + ödeme hareketi + iadeler). */
export function normalizeEbayOrder(order: Json): NormalizedOrder {
  const id = str(order.orderId) ?? "";
  const lineItems = Array.isArray(order.lineItems) ? (order.lineItems as Json[]) : [];
  const pricing = (order.pricingSummary ?? {}) as Json;
  const paymentSummary = (order.paymentSummary ?? {}) as Json;
  const refundList = Array.isArray(paymentSummary.refunds)
    ? (paymentSummary.refunds as Json[])
    : [];
  const buyer = (order.buyer ?? {}) as Json;
  const buyerAddr = (buyer.buyerRegistrationAddress ?? {}) as Json;

  const total = pricing.total;
  const currency = currencyOf(total) ?? "USD";
  const created = ebayTs(order.creationDate);
  const updated = ebayTs(order.lastModifiedDate);
  const totalRefunded = refundList.reduce(
    (sum, r) => sum + Number(ebayMoney(r.amount) ?? 0),
    0,
  );
  const isRefunded = totalRefunded > 0;
  const isPaid = order.orderPaymentStatus === "PAID";

  const transactions: NormalizedTransaction[] = [
    {
      externalId: `${id}-payment`,
      kind: "sale",
      status: isPaid ? "success" : "pending",
      gateway: "ebay_managed_payments",
      amount: ebayMoney(total),
      // Ham eBay ücreti totalFeeBasisAmount değil; gerçek ücret Finances API'de.
      // Sentetik veri `totalMarketplaceFee` verirse onu kullanırız, yoksa kural motoru.
      fee: ebayMoney(order.totalMarketplaceFee) ?? null,
      currency,
      processedAt: created,
    },
  ];

  return {
    externalId: id,
    name: str(order.legacyOrderId) ?? `#${id}`,
    email: str(buyerAddr.email),
    customerExternalId: str(buyer.username),
    financialStatus: isRefunded ? "refunded" : isPaid ? "paid" : "pending",
    fulfillmentStatus:
      order.orderFulfillmentStatus === "FULFILLED" ? "fulfilled" : "unfulfilled",
    currency,
    presentmentCurrency: currency,
    subtotalPrice: ebayMoney(pricing.priceSubtotal),
    totalPrice: ebayMoney(total),
    totalDiscounts: ebayMoney(pricing.priceDiscount),
    totalTax: ebayMoney(pricing.tax),
    totalShipping: ebayMoney(pricing.deliveryCost),
    totalRefunded: isRefunded ? totalRefunded.toFixed(2) : null,
    test: false,
    processedAt: created,
    cancelledAt: order.cancelStatus === "CANCELED" ? updated : null,
    shopifyCreatedAt: created,
    shopifyUpdatedAt: updated,
    lineItems: lineItems.map(normalizeEbayLineItem),
    transactions,
    refunds: refundList.map((r, i) => normalizeEbayRefund(r, i, id)),
  };
}

/** eBay buyer (order'dan türetilmiş) → NormalizedCustomer. */
export function normalizeEbayBuyer(buyer: Json): NormalizedCustomer {
  return {
    externalId: str(buyer.username) ?? "",
    email: str(buyer.email),
    firstName: str(buyer.first_name),
    lastName: str(buyer.last_name),
    ordersCount: num(buyer.orders_count),
    totalSpent: ebayMoney(buyer.total_spent) ?? str(buyer.total_spent),
    currency: currencyOf(buyer.total_spent) ?? "USD",
    shopifyCreatedAt: null,
    shopifyUpdatedAt: null,
  };
}
