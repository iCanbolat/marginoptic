import {
  extractId,
  normalizeCustomer,
  normalizeOrder,
  normalizeProduct,
  normalizeRefund,
} from "./shopify-normalizer";

describe("extractId", () => {
  it("GID'den sondaki segmenti alır", () => {
    expect(extractId("gid://shopify/Order/12345")).toBe("12345");
    expect(extractId("gid://shopify/ProductVariant/70")).toBe("70");
  });
  it("numerik id'yi string'e çevirir", () => {
    expect(extractId(12345)).toBe("12345");
    expect(extractId(null)).toBe("");
  });
});

describe("normalizeOrder (REST webhook)", () => {
  const rest = {
    id: 12345,
    name: "#1001",
    email: "a@b.com",
    customer: { id: 999 },
    financial_status: "PAID",
    fulfillment_status: "fulfilled",
    currency: "USD",
    presentment_currency: "USD",
    subtotal_price: "40.00",
    total_price: "48.99",
    total_discounts: "5.00",
    total_tax: "4.00",
    total_shipping_price_set: { shop_money: { amount: "4.99" } },
    test: false,
    processed_at: "2025-05-01T12:00:00Z",
    created_at: "2025-05-01T12:00:00Z",
    updated_at: "2025-05-02T12:00:00Z",
    line_items: [
      {
        id: 1,
        product_id: 7,
        variant_id: 70,
        sku: "SKU-1",
        title: "Ürün X",
        quantity: 2,
        price: "20.00",
        total_discount: "5.00",
      },
    ],
    transactions: [
      {
        id: 555,
        kind: "sale",
        status: "success",
        gateway: "shopify_payments",
        amount: "48.99",
        fee: "1.72",
        currency: "USD",
        processed_at: "2025-05-01T12:00:00Z",
      },
    ],
    refunds: [
      {
        id: 888,
        created_at: "2025-05-03T12:00:00Z",
        note: "iade",
        transactions: [{ amount: "10.00", kind: "refund" }],
        refund_line_items: [{ total_tax: "1.00" }],
        order_adjustments: [{ amount: "-4.99" }],
      },
    ],
  };

  it("üst-seviye alanları çözer", () => {
    const o = normalizeOrder(rest);
    expect(o.externalId).toBe("12345");
    expect(o.customerExternalId).toBe("999");
    expect(o.financialStatus).toBe("paid");
    expect(o.totalShipping).toBe("4.99");
    expect(o.test).toBe(false);
    expect(o.processedAt?.toISOString()).toBe("2025-05-01T12:00:00.000Z");
  });

  it("satır toplamını hesaplar", () => {
    const li = normalizeOrder(rest).lineItems[0];
    expect(li.externalId).toBe("1");
    expect(li.productExternalId).toBe("7");
    expect(li.variantExternalId).toBe("70");
    expect(li.quantity).toBe(2);
    expect(li.totalAmount).toBe("35.0000"); // 20*2 - 5
  });

  it("hareket ve iadeleri çözer", () => {
    const o = normalizeOrder(rest);
    expect(o.transactions[0].fee).toBe("1.72");
    expect(o.refunds[0].amount).toBe("10.0000");
    expect(o.refunds[0].taxRefunded).toBe("1.0000");
    expect(o.refunds[0].shippingRefunded).toBe("4.9900");
  });
});

describe("normalizeOrder (Bulk GraphQL)", () => {
  const node = {
    id: "gid://shopify/Order/12345",
    name: "#1001",
    displayFinancialStatus: "PAID",
    currencyCode: "USD",
    totalPriceSet: { shopMoney: { amount: "48.99" } },
    customer: { id: "gid://shopify/Customer/999" },
    lineItems: [
      {
        id: "gid://shopify/LineItem/1",
        sku: "SKU-1",
        quantity: 2,
        product: { id: "gid://shopify/Product/7" },
        variant: { id: "gid://shopify/ProductVariant/70" },
        originalUnitPriceSet: { shopMoney: { amount: "20.00" } },
        discountedTotalSet: { shopMoney: { amount: "35.00" } },
      },
    ],
  };

  it("GID'leri numerik id'ye indirger ve money set'leri çözer", () => {
    const o = normalizeOrder(node);
    expect(o.externalId).toBe("12345");
    expect(o.customerExternalId).toBe("999");
    expect(o.financialStatus).toBe("paid");
    expect(o.totalPrice).toBe("48.99");
    expect(o.lineItems[0].productExternalId).toBe("7");
    expect(o.lineItems[0].variantExternalId).toBe("70");
    expect(o.lineItems[0].totalAmount).toBe("35.00");
  });
});

describe("normalizeRefund / normalizeProduct / normalizeCustomer", () => {
  it("bağımsız iade webhook'unu çözer", () => {
    const r = normalizeRefund({
      id: 888,
      order_id: 12345,
      created_at: "2025-05-03T12:00:00Z",
      transactions: [{ amount: "12.50", kind: "refund" }],
    });
    expect(r.externalId).toBe("888");
    expect(r.amount).toBe("12.5000");
  });

  it("ürünü ve varyantları çözer (status küçük harf)", () => {
    const p = normalizeProduct({
      id: 7,
      title: "Ürün X",
      handle: "urun-x",
      status: "ACTIVE",
      variants: [
        { id: 70, product_id: 7, sku: "SKU-1", price: "20.00", inventory_quantity: 5 },
      ],
    });
    expect(p.externalId).toBe("7");
    expect(p.status).toBe("active");
    expect(p.variants[0].externalId).toBe("70");
    expect(p.variants[0].price).toBe("20.00");
    expect(p.variants[0].inventoryQuantity).toBe(5);
  });

  it("müşteriyi çözer", () => {
    const c = normalizeCustomer({
      id: 999,
      email: "a@b.com",
      first_name: "Ada",
      last_name: "Lovelace",
      orders_count: 3,
      total_spent: "120.00",
      currency: "USD",
    });
    expect(c.externalId).toBe("999");
    expect(c.ordersCount).toBe(3);
    expect(c.totalSpent).toBe("120.00");
  });
});
