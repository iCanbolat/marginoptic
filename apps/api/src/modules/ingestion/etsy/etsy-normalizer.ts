import type {
  NormalizedCustomer,
  NormalizedLineItem,
  NormalizedOrder,
  NormalizedProduct,
  NormalizedRefund,
  NormalizedTransaction,
} from "../ingestion.types";

/**
 * Faz 9 — Etsy Open API v3 JSON → sağlayıcıdan bağımsız Normalized* şekiller.
 * Saf (yan etkisiz) fonksiyonlar; `@churnify/shared` runtime import'u YOK (jest-uyumlu).
 *
 * Etsy para alanları `Money { amount, divisor, currency_code }` (amount tamsayı,
 * gerçek değer = amount/divisor). Zaman damgaları unix **saniye**.
 */

type Json = Record<string, unknown>;

interface EtsyMoney {
  amount?: number;
  divisor?: number;
  currency_code?: string;
}

/** Etsy Money → ana-birim ondalık string (örn. 1999/100 → "19.99"). */
export function etsyMoney(m: unknown): string | null {
  const money = m as EtsyMoney | null | undefined;
  if (!money || typeof money.amount !== "number") return null;
  const divisor = typeof money.divisor === "number" && money.divisor > 0 ? money.divisor : 100;
  return (money.amount / divisor).toFixed(2);
}

function currencyOf(m: unknown): string | null {
  const money = m as EtsyMoney | null | undefined;
  return money?.currency_code ?? null;
}

/** Unix saniye → Date. */
export function etsyTs(sec: unknown): Date | null {
  return typeof sec === "number" && Number.isFinite(sec)
    ? new Date(sec * 1000)
    : null;
}

const str = (v: unknown): string | null =>
  v == null ? null : String(v);
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);

/** Etsy listing → NormalizedProduct (tek varyant: listing fiyatı + sku). */
export function normalizeEtsyListing(listing: Json): NormalizedProduct {
  const id = str(listing.listing_id) ?? "";
  const price = etsyMoney(listing.price);
  const skus = Array.isArray(listing.skus) ? listing.skus : [];
  const sku = skus.length > 0 ? str(skus[0]) : null;
  const created = etsyTs(listing.created_timestamp ?? listing.creation_timestamp);
  const updated = etsyTs(listing.updated_timestamp ?? listing.last_modified_timestamp);
  return {
    externalId: id,
    title: str(listing.title) ?? `Etsy listing ${id}`,
    handle: str(listing.url) ?? null,
    status: str(listing.state) ?? null,
    vendor: null,
    productType: str(listing.taxonomy_id),
    shopifyCreatedAt: created,
    shopifyUpdatedAt: updated,
    variants: [
      {
        externalId: `${id}-0`,
        externalProductId: id,
        sku,
        title: str(listing.title),
        price,
        inventoryQuantity: typeof listing.quantity === "number" ? listing.quantity : null,
        shopifyCreatedAt: created,
        shopifyUpdatedAt: updated,
      },
    ],
  };
}

/** Etsy receipt transaction → NormalizedLineItem. */
function normalizeEtsyTransaction(t: Json): NormalizedLineItem {
  const qty = num(t.quantity) || 1;
  const price = etsyMoney(t.price);
  const total = price != null ? (Number(price) * qty).toFixed(2) : null;
  return {
    externalId: str(t.transaction_id) ?? "",
    productExternalId: str(t.listing_id),
    variantExternalId: t.product_id != null ? str(t.product_id) : null,
    sku: str(t.sku),
    title: str(t.title),
    quantity: qty,
    price,
    discountAmount: null,
    totalAmount: total,
  };
}

/** Etsy refund → NormalizedRefund. */
function normalizeEtsyRefund(r: Json, idx: number, receiptId: string): NormalizedRefund {
  return {
    externalId: str(r.refund_id) ?? `${receiptId}-refund-${idx}`,
    amount: etsyMoney(r.amount),
    shippingRefunded: null,
    taxRefunded: null,
    note: str(r.note_from_issuer ?? r.reason),
    processedAt: etsyTs(r.created_timestamp),
    shopifyCreatedAt: etsyTs(r.created_timestamp),
  };
}

/** Etsy receipt → NormalizedOrder (satırlar + ödeme hareketi + iadeler). */
export function normalizeEtsyReceipt(receipt: Json): NormalizedOrder {
  const id = str(receipt.receipt_id) ?? "";
  const txns = Array.isArray(receipt.transactions) ? (receipt.transactions as Json[]) : [];
  const refundList = Array.isArray(receipt.refunds) ? (receipt.refunds as Json[]) : [];
  const grand = receipt.grandtotal ?? receipt.total_price;
  const currency = currencyOf(grand) ?? "USD";
  const created = etsyTs(receipt.create_timestamp ?? receipt.created_timestamp);
  const updated = etsyTs(receipt.update_timestamp ?? receipt.updated_timestamp);
  const totalRefunded = refundList.reduce(
    (sum, r) => sum + Number(etsyMoney(r.amount) ?? 0),
    0,
  );
  const isRefunded = totalRefunded > 0;

  const lineItems = txns.map(normalizeEtsyTransaction);

  // Etsy receipt'i ham işlem ücreti vermez → ücret kural motoruna (payment_fee_rules)
  // bırakılır. Sentetik veri `payment_fee` verirse onu kullanırız.
  const transactions: NormalizedTransaction[] = [
    {
      externalId: `${id}-payment`,
      kind: "sale",
      status: receipt.is_paid ? "success" : "pending",
      gateway: "etsy_payments",
      amount: etsyMoney(grand),
      fee: etsyMoney(receipt.payment_fee) ?? null,
      currency,
      processedAt: created,
    },
  ];

  return {
    externalId: id,
    name: str(receipt.name) ?? `#${id}`,
    email: str(receipt.buyer_email),
    customerExternalId: str(receipt.buyer_user_id),
    financialStatus: isRefunded ? "refunded" : receipt.is_paid ? "paid" : "pending",
    fulfillmentStatus: receipt.is_shipped ? "fulfilled" : "unfulfilled",
    currency,
    presentmentCurrency: currency,
    subtotalPrice: etsyMoney(receipt.subtotal),
    totalPrice: etsyMoney(grand),
    totalDiscounts: etsyMoney(receipt.discount_amt),
    totalTax: etsyMoney(receipt.total_tax_cost),
    totalShipping: etsyMoney(receipt.total_shipping_cost),
    totalRefunded: isRefunded ? totalRefunded.toFixed(2) : null,
    test: false,
    processedAt: created,
    cancelledAt: null,
    shopifyCreatedAt: created,
    shopifyUpdatedAt: updated,
    lineItems,
    transactions,
    refunds: refundList.map((r, i) => normalizeEtsyRefund(r, i, id)),
  };
}

/** Etsy buyer (sentetik / receipt'ten türetilmiş) → NormalizedCustomer. */
export function normalizeEtsyBuyer(buyer: Json): NormalizedCustomer {
  return {
    externalId: str(buyer.user_id) ?? "",
    email: str(buyer.primary_email ?? buyer.email),
    firstName: str(buyer.first_name),
    lastName: str(buyer.last_name),
    ordersCount: num(buyer.orders_count),
    totalSpent: etsyMoney(buyer.total_spent) ?? str(buyer.total_spent),
    currency: currencyOf(buyer.total_spent) ?? "USD",
    shopifyCreatedAt: etsyTs(buyer.create_timestamp),
    shopifyUpdatedAt: etsyTs(buyer.update_timestamp),
  };
}
