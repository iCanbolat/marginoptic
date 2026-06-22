import { normalizeOrder } from "../normalizers/shopify-normalizer";
import { generateSynthetic } from "./synthetic";

describe("generateSynthetic", () => {
  it("aynı shop için deterministik (idempotent) id üretir", () => {
    const a = generateSynthetic("orders", "demo.myshopify.com");
    const b = generateSynthetic("orders", "demo.myshopify.com");
    expect(a.map((o) => o.id)).toEqual(b.map((o) => o.id));
  });

  it("farklı kaynaklar üretir ve sipariş normalize olur", () => {
    const orders = generateSynthetic("orders", "x.myshopify.com");
    const products = generateSynthetic("products", "x.myshopify.com");
    const customers = generateSynthetic("customers", "x.myshopify.com");
    expect(orders.length).toBeGreaterThan(0);
    expect(products.length).toBeGreaterThan(0);
    expect(customers.length).toBeGreaterThan(0);

    const o = normalizeOrder(orders[0]);
    expect(o.externalId).not.toBe("");
    expect(o.lineItems.length).toBeGreaterThan(0);
    expect(o.transactions[0].fee).not.toBeNull();
  });
});
