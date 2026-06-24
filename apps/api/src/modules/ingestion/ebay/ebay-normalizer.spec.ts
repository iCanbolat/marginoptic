import {
  ebayMoney,
  ebayTs,
  normalizeEbayBuyer,
  normalizeEbayInventoryItem,
  normalizeEbayOrder,
} from "./ebay-normalizer";
import { generateEbaySynthetic } from "./ebay-synthetic";

describe("ebay-normalizer", () => {
  describe("yardımcılar", () => {
    it("ebayMoney value → ondalık string", () => {
      expect(ebayMoney({ value: "19.99", currency: "USD" })).toBe("19.99");
      expect(ebayMoney({ value: 5, currency: "USD" })).toBe("5.00");
      expect(ebayMoney(null)).toBeNull();
      expect(ebayMoney({ currency: "USD" })).toBeNull();
    });

    it("ebayTs ISO string → Date", () => {
      const d = ebayTs("2025-01-01T00:00:00.000Z");
      expect(d).toBeInstanceOf(Date);
      expect(d?.toISOString()).toBe("2025-01-01T00:00:00.000Z");
      expect(ebayTs(null)).toBeNull();
      expect(ebayTs("")).toBeNull();
    });
  });

  describe("inventory item → product", () => {
    it("başlık, fiyat, sku ve miktar doğru eşlenir", () => {
      const [item] = generateEbaySynthetic("products", "demo-shop");
      const p = normalizeEbayInventoryItem(item);
      expect(p.title).toBe("Retro Kol Saati");
      expect(p.status).toBe("active");
      expect(p.variants).toHaveLength(1);
      expect(p.variants[0]!.price).toBe("29.99");
      expect(p.variants[0]!.inventoryQuantity).toBe(50);
      expect(p.externalId).toBe(p.variants[0]!.sku);
    });
  });

  describe("order → order", () => {
    const orders = generateEbaySynthetic("orders", "demo-shop");

    it("ilk order: indirimli, vergili, kargolu toplam + iade", () => {
      // i=0: qty=1, unit=29.99, discount=5 → subtotal 24.99, tax 8% ≈ 2.00, shipping 6.5
      const o = normalizeEbayOrder(orders[0]!);
      expect(o.currency).toBe("USD");
      expect(o.subtotalPrice).toBe("24.99");
      expect(o.totalDiscounts).toBe("5.00");
      expect(o.totalShipping).toBe("6.50");
      expect(o.lineItems).toHaveLength(1);
      expect(o.lineItems[0]!.quantity).toBe(1);
      expect(o.lineItems[0]!.price).toBe("29.99");
      // i=0 → refunded (i%9===0)
      expect(o.financialStatus).toBe("refunded");
      expect(o.refunds).toHaveLength(1);
      expect(o.transactions[0]!.gateway).toBe("ebay_managed_payments");
      expect(o.transactions[0]!.fee).not.toBeNull();
    });

    it("refund olmayan order paid + iade yok", () => {
      const o = normalizeEbayOrder(orders[1]!);
      expect(o.financialStatus).toBe("paid");
      expect(o.refunds).toHaveLength(0);
      expect(o.totalRefunded).toBeNull();
      expect(o.fulfillmentStatus).toBe("fulfilled");
    });

    it("line item totalAmount = price * qty", () => {
      const o = normalizeEbayOrder(orders[2]!);
      const li = o.lineItems[0]!;
      expect(li.totalAmount).toBe((Number(li.price) * li.quantity).toFixed(2));
    });
  });

  describe("buyer → customer", () => {
    it("e-posta ve harcama eşlenir", () => {
      const [buyer] = generateEbaySynthetic("customers", "demo-shop");
      const c = normalizeEbayBuyer(buyer);
      expect(c.email).toBe("ebaybuyer1@example.com");
      expect(c.totalSpent).toBe("80.00");
      expect(c.ordersCount).toBe(1);
    });
  });

  describe("determinizm", () => {
    it("aynı shop → aynı id'ler (idempotent)", () => {
      const a = generateEbaySynthetic("orders", "demo-shop");
      const b = generateEbaySynthetic("orders", "demo-shop");
      expect(normalizeEbayOrder(a[0]!).externalId).toBe(
        normalizeEbayOrder(b[0]!).externalId,
      );
    });
  });
});
