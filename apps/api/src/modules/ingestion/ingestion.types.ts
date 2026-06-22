/**
 * Sağlayıcıdan bağımsız "normalize edilmiş" ara şekiller.
 * Hem REST webhook gövdeleri hem Bulk GraphQL düğümleri bu şekillere indirgenir;
 * IngestionService bunları DB'ye idempotent yazar.
 */

export interface NormalizedLineItem {
  externalId: string;
  productExternalId: string | null;
  variantExternalId: string | null;
  sku: string | null;
  title: string | null;
  quantity: number;
  price: string | null;
  discountAmount: string | null;
  totalAmount: string | null;
}

export interface NormalizedTransaction {
  externalId: string;
  kind: string | null;
  status: string | null;
  gateway: string | null;
  amount: string | null;
  fee: string | null;
  currency: string | null;
  processedAt: Date | null;
}

export interface NormalizedRefund {
  externalId: string;
  amount: string | null;
  shippingRefunded: string | null;
  taxRefunded: string | null;
  note: string | null;
  processedAt: Date | null;
  shopifyCreatedAt: Date | null;
}

export interface NormalizedOrder {
  externalId: string;
  name: string | null;
  email: string | null;
  customerExternalId: string | null;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  currency: string | null;
  presentmentCurrency: string | null;
  subtotalPrice: string | null;
  totalPrice: string | null;
  totalDiscounts: string | null;
  totalTax: string | null;
  totalShipping: string | null;
  totalRefunded: string | null;
  test: boolean;
  processedAt: Date | null;
  cancelledAt: Date | null;
  shopifyCreatedAt: Date | null;
  shopifyUpdatedAt: Date | null;
  lineItems: NormalizedLineItem[];
  transactions: NormalizedTransaction[];
  refunds: NormalizedRefund[];
}

export interface NormalizedVariant {
  externalId: string;
  externalProductId: string | null;
  sku: string | null;
  title: string | null;
  price: string | null;
  inventoryQuantity: number | null;
  shopifyCreatedAt: Date | null;
  shopifyUpdatedAt: Date | null;
}

export interface NormalizedProduct {
  externalId: string;
  title: string;
  handle: string | null;
  status: string | null;
  vendor: string | null;
  productType: string | null;
  shopifyCreatedAt: Date | null;
  shopifyUpdatedAt: Date | null;
  variants: NormalizedVariant[];
}

export interface NormalizedCustomer {
  externalId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  ordersCount: number;
  totalSpent: string | null;
  currency: string | null;
  shopifyCreatedAt: Date | null;
  shopifyUpdatedAt: Date | null;
}
