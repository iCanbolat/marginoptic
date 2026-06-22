import type { ShopifySyncResource } from "../../sync/sync.constants";

/** Bulk JSONL alt-tip → ebeveyn alan adı eşlemesi (reconstructBulkObjects için). */
export const BULK_CHILD_FIELDS: Record<ShopifySyncResource, Record<string, string>> = {
  orders: { LineItem: "lineItems" },
  products: { ProductVariant: "variants" },
  customers: {},
};

const ORDER_FIELDS = `
  id
  name
  email
  createdAt
  updatedAt
  processedAt
  cancelledAt
  test
  displayFinancialStatus
  displayFulfillmentStatus
  currencyCode
  presentmentCurrencyCode
  subtotalPriceSet { shopMoney { amount } }
  totalPriceSet { shopMoney { amount } }
  totalDiscountsSet { shopMoney { amount } }
  totalTaxSet { shopMoney { amount } }
  totalShippingPriceSet { shopMoney { amount } }
  totalRefundedSet { shopMoney { amount } }
  customer { id }
  lineItems {
    edges {
      node {
        id
        sku
        title
        quantity
        product { id }
        variant { id }
        originalUnitPriceSet { shopMoney { amount } }
        discountedTotalSet { shopMoney { amount } }
        totalDiscountSet { shopMoney { amount } }
      }
    }
  }
`;

const PRODUCT_FIELDS = `
  id
  title
  handle
  status
  vendor
  productType
  createdAt
  updatedAt
  variants {
    edges {
      node {
        id
        sku
        title
        price
        inventoryQuantity
        createdAt
        updatedAt
      }
    }
  }
`;

const CUSTOMER_FIELDS = `
  id
  email
  firstName
  lastName
  numberOfOrders
  amountSpent { amount currencyCode }
  createdAt
  updatedAt
`;

/**
 * Bir kaynak için Bulk Operations sorgusu döndürür.
 * NOT: sipariş hareketleri (transactions) ve iadeler (refunds) backfill'de değil,
 * artımlı webhook'larla yakalanır (gerçek mağaza ile doğrulanınca genişletilecek).
 */
export function bulkQueryFor(
  resource: ShopifySyncResource,
  filter?: string,
): string {
  const arg = filter ? `(query: ${JSON.stringify(filter)})` : "";
  const map: Record<ShopifySyncResource, string> = {
    orders: `{ orders${arg} { edges { node { ${ORDER_FIELDS} } } } }`,
    products: `{ products${arg} { edges { node { ${PRODUCT_FIELDS} } } } }`,
    customers: `{ customers${arg} { edges { node { ${CUSTOMER_FIELDS} } } } }`,
  };
  return map[resource];
}

export const BULK_RUN_MUTATION = `
mutation bulkRun($query: String!) {
  bulkOperationRunQuery(query: $query) {
    bulkOperation { id status }
    userErrors { field message }
  }
}`;

export const CURRENT_BULK_QUERY = `
query {
  currentBulkOperation {
    id
    status
    errorCode
    objectCount
    url
  }
}`;
