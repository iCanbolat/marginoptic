import {
  amazonMoney,
  amazonTs,
  normalizeAmazonBuyer,
  normalizeAmazonListing,
  normalizeAmazonOrder,
} from "./amazon-normalizer";
import { generateAmazonSynthetic } from "./amazon-synthetic";

describe("amazon-normalizer", () => {
  describe("yardımcılar", () => {
    it("amazonMoney Amount → ondalık string", () => {
      expect(amazonMoney({ Amount: "19.99", CurrencyCode: "USD" })).toBe("19.99");
      expect(amazonMoney({ Amount: 5, CurrencyCode: "USD" })).toBe("5.00");
      expect(amazonMoney(null)).toBeNull();
      expect(amazonMoney({ CurrencyCode: "USD" })).toBeNull();
    });

    it("amazonTs ISO string → Date", () => {
      const d = amazonTs("2025-01-01T00:00:00.000Z");
      expect(d).toBeInstanceOf(Date);
      expect(d?.toISOString()).toBe("2025-01-01T00:00:00.000Z");
      expect(amazonTs(null)).toBeNull();
      expect(amazonTs("")).toBeNull();
    });
  });

  describe("listing → product", () => {
    it("başlık, fiyat, sku ve miktar doğru eşlenir", () => {
      const [item] = generateAmazonSynthetic("products", "demo-shop");
      const p = normalizeAmazonListing(item);
      expect(p.title).toBe("Kablosuz Şarj Cihazı");
      expect(p.status).toBe("active");
      expect(p.variants).toHaveLength(1);
      expect(p.variants[0]!.price).toBe("34.99");
      expect(p.variants[0]!.inventoryQuantity).toBe(50);
      expect(p.externalId).toBe(p.variants[0]!.sku);
    });
  });

  describe("order → order", () => {
    const orders = generateAmazonSynthetic("orders", "demo-shop");

    it("ilk order: indirimli, vergili, kargolu toplam + iade", () => {
      // i=0: qty=1, unit=34.99, discount=5 → subtotal 29.99, tax 8% ≈ 2.40, shipping 6.5
      const o = normalizeAmazonOrder(orders[0]!);
      expect(o.currency).toBe("USD");
      expect(o.subtotalPrice).toBe("29.99");
      expect(o.totalDiscounts).toBe("5.00");
      expect(o.totalShipping).toBe("6.50");
      expect(o.lineItems).toHaveLength(1);
      expect(o.lineItems[0]!.quantity).toBe(1);
      expect(o.lineItems[0]!.price).toBe("34.99");
      // i=0 → refunded (i%9===0)
      expect(o.financialStatus).toBe("refunded");
      expect(o.refunds).toHaveLength(1);
      expect(o.transactions[0]!.gateway).toBe("amazon_pay");
      expect(o.transactions[0]!.fee).not.toBeNull();
    });

    it("refund olmayan order paid + iade yok, kargolanmış → fulfilled", () => {
      const o = normalizeAmazonOrder(orders[1]!);
      expect(o.financialStatus).toBe("paid");
      expect(o.refunds).toHaveLength(0);
      expect(o.totalRefunded).toBeNull();
      expect(o.fulfillmentStatus).toBe("fulfilled");
    });

    it("line item totalAmount = price * qty", () => {
      const o = normalizeAmazonOrder(orders[2]!);
      const li = o.lineItems[0]!;
      expect(li.totalAmount).toBe((Number(li.price) * li.quantity).toFixed(2));
    });
  });

  describe("buyer → customer", () => {
    it("e-posta ve harcama eşlenir", () => {
      const [buyer] = generateAmazonSynthetic("customers", "demo-shop");
      const c = normalizeAmazonBuyer(buyer);
      expect(c.email).toBe("amzbuyer1@example.com");
      expect(c.totalSpent).toBe("100.00");
      expect(c.ordersCount).toBe(1);
    });
  });

  describe("determinizm", () => {
    it("aynı shop → aynı id'ler (idempotent)", () => {
      const a = generateAmazonSynthetic("orders", "demo-shop");
      const b = generateAmazonSynthetic("orders", "demo-shop");
      expect(normalizeAmazonOrder(a[0]!).externalId).toBe(
        normalizeAmazonOrder(b[0]!).externalId,
      );
    });
  });
});
