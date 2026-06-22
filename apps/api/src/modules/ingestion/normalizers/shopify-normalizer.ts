import type {
  NormalizedCustomer,
  NormalizedLineItem,
  NormalizedOrder,
  NormalizedProduct,
  NormalizedRefund,
  NormalizedTransaction,
  NormalizedVariant,
} from "../ingestion.types";

type Json = Record<string, unknown>;

/** GID veya numerik id'yi tek biçime (sadece numerik/sondaki segment) indirger. */
export function extractId(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (s.startsWith("gid://")) {
    const parts = s.split("/");
    return parts[parts.length - 1] ?? s;
  }
  return s;
}

function optId(value: unknown): string | null {
  const id = extractId(value);
  return id === "" ? null : id;
}

function str(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

/** Para alanı: REST düz string ("12.50") ya da GraphQL `*Set.shopMoney.amount`. */
function money(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "object") {
    const set = value as Json;
    const shopMoney = (set.shopMoney ?? set.shop_money) as Json | undefined;
    if (shopMoney) return money(shopMoney.amount);
    if ("amount" in set) return money(set.amount);
    return null;
  }
  const s = String(value).trim();
  return s === "" ? null : s;
}

function int(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function date(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function asArray(value: unknown): Json[] {
  if (Array.isArray(value)) return value as Json[];
  // GraphQL bağlantısı: { edges: [{ node }] }
  if (value && typeof value === "object" && "edges" in (value as Json)) {
    const edges = (value as Json).edges;
    if (Array.isArray(edges)) {
      return edges.map((e) => (e as Json).node as Json).filter(Boolean);
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Satır / hareket / iade
// ---------------------------------------------------------------------------

function lineItem(raw: Json): NormalizedLineItem {
  const quantity = int(raw.quantity);
  const price = money(raw.price ?? raw.originalUnitPriceSet);
  const discountAmount =
    money(raw.total_discount ?? raw.totalDiscountSet) ?? null;
  let totalAmount = money(raw.discountedTotalSet);
  if (totalAmount == null && price != null) {
    const gross = Number(price) * quantity - Number(discountAmount ?? 0);
    totalAmount = Number.isFinite(gross) ? gross.toFixed(4) : null;
  }
  return {
    externalId: extractId(raw.id),
    productExternalId: optId((raw.product as Json)?.id ?? raw.product_id),
    variantExternalId: optId((raw.variant as Json)?.id ?? raw.variant_id),
    sku: str(raw.sku),
    title: str(raw.title ?? raw.name),
    quantity,
    price,
    discountAmount,
    totalAmount,
  };
}

function transaction(raw: Json): NormalizedTransaction {
  return {
    externalId: extractId(raw.id),
    kind: str(raw.kind),
    status: str(raw.status),
    gateway: str(raw.gateway),
    amount: money(raw.amount ?? raw.amountSet),
    fee: money(raw.fee ?? raw.feeAmount),
    currency: str(raw.currency ?? raw.currencyCode),
    processedAt: date(raw.processed_at ?? raw.processedAt ?? raw.created_at),
  };
}

function refund(raw: Json): NormalizedRefund {
  const txns = asArray(raw.transactions);
  // İade tutarı: refund transaction'larının (kind=refund) toplamı.
  let amount = money(raw.totalRefundedSet ?? raw.amount);
  if (amount == null && txns.length > 0) {
    const sum = txns.reduce((acc, t) => acc + Number(money(t.amount) ?? 0), 0);
    amount = sum.toFixed(4);
  }
  const refundLineItems = asArray(raw.refund_line_items ?? raw.refundLineItems);
  const taxRefunded = refundLineItems.reduce(
    (acc, r) => acc + Number(money(r.total_tax ?? r.totalTaxSet) ?? 0),
    0,
  );
  const adjustments = asArray(raw.order_adjustments ?? raw.orderAdjustments);
  const shippingRefunded = adjustments.reduce(
    (acc, a) => acc + Math.abs(Number(money(a.amount ?? a.amountSet) ?? 0)),
    0,
  );
  return {
    externalId: extractId(raw.id),
    amount,
    shippingRefunded: shippingRefunded ? shippingRefunded.toFixed(4) : null,
    taxRefunded: taxRefunded ? taxRefunded.toFixed(4) : null,
    note: str(raw.note),
    processedAt: date(raw.processed_at ?? raw.processedAt ?? raw.created_at),
    shopifyCreatedAt: date(raw.created_at ?? raw.createdAt),
  };
}

// ---------------------------------------------------------------------------
// Üst-seviye varlıklar (REST webhook + Bulk GraphQL ortak)
// ---------------------------------------------------------------------------

/** Bir sipariş düğümünü (REST gövdesi veya bulk node) NormalizedOrder'a çevirir. */
export function normalizeOrder(raw: Json): NormalizedOrder {
  return {
    externalId: extractId(raw.id),
    name: str(raw.name),
    email: str(raw.email ?? raw.contactEmail),
    customerExternalId: optId(
      (raw.customer as Json)?.id ?? raw.customer_id,
    ),
    financialStatus: str(
      raw.financial_status ?? raw.displayFinancialStatus,
    )?.toLowerCase() ?? null,
    fulfillmentStatus:
      str(raw.fulfillment_status ?? raw.displayFulfillmentStatus)?.toLowerCase() ??
      null,
    currency: str(raw.currency ?? raw.currencyCode),
    presentmentCurrency: str(
      raw.presentment_currency ?? raw.presentmentCurrencyCode,
    ),
    subtotalPrice: money(raw.subtotal_price ?? raw.subtotalPriceSet),
    totalPrice: money(raw.total_price ?? raw.totalPriceSet),
    totalDiscounts: money(raw.total_discounts ?? raw.totalDiscountsSet),
    totalTax: money(raw.total_tax ?? raw.totalTaxSet),
    totalShipping: money(
      raw.total_shipping_price_set ?? raw.totalShippingPriceSet,
    ),
    totalRefunded: money(raw.totalRefundedSet),
    test: Boolean(raw.test),
    processedAt: date(raw.processed_at ?? raw.processedAt),
    cancelledAt: date(raw.cancelled_at ?? raw.cancelledAt),
    shopifyCreatedAt: date(raw.created_at ?? raw.createdAt),
    shopifyUpdatedAt: date(raw.updated_at ?? raw.updatedAt),
    lineItems: asArray(raw.line_items ?? raw.lineItems).map(lineItem),
    transactions: asArray(raw.transactions).map(transaction),
    refunds: asArray(raw.refunds).map(refund),
  };
}

export function normalizeRefund(raw: Json): NormalizedRefund {
  return refund(raw);
}

function variant(raw: Json): NormalizedVariant {
  return {
    externalId: extractId(raw.id),
    externalProductId: optId((raw.product as Json)?.id ?? raw.product_id),
    sku: str(raw.sku),
    title: str(raw.title),
    price: money(raw.price),
    inventoryQuantity:
      raw.inventory_quantity != null || raw.inventoryQuantity != null
        ? int(raw.inventory_quantity ?? raw.inventoryQuantity)
        : null,
    shopifyCreatedAt: date(raw.created_at ?? raw.createdAt),
    shopifyUpdatedAt: date(raw.updated_at ?? raw.updatedAt),
  };
}

export function normalizeProduct(raw: Json): NormalizedProduct {
  return {
    externalId: extractId(raw.id),
    title: str(raw.title) ?? "(başlıksız)",
    handle: str(raw.handle),
    status: str(raw.status)?.toLowerCase() ?? null,
    vendor: str(raw.vendor),
    productType: str(raw.product_type ?? raw.productType),
    shopifyCreatedAt: date(raw.created_at ?? raw.createdAt),
    shopifyUpdatedAt: date(raw.updated_at ?? raw.updatedAt),
    variants: asArray(raw.variants).map(variant),
  };
}

export function normalizeCustomer(raw: Json): NormalizedCustomer {
  const name = str(raw.displayName);
  return {
    externalId: extractId(raw.id),
    email: str(raw.email),
    firstName: str(raw.first_name ?? raw.firstName) ?? name,
    lastName: str(raw.last_name ?? raw.lastName),
    ordersCount: int(raw.orders_count ?? raw.numberOfOrders ?? 0),
    totalSpent: money(raw.total_spent ?? raw.amountSpent),
    currency: str(raw.currency ?? raw.currencyCode),
    shopifyCreatedAt: date(raw.created_at ?? raw.createdAt),
    shopifyUpdatedAt: date(raw.updated_at ?? raw.updatedAt),
  };
}
