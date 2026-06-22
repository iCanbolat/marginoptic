import {
  etsyMoney,
  etsyTs,
  normalizeEtsyBuyer,
  normalizeEtsyListing,
  normalizeEtsyReceipt,
} from "./etsy-normalizer";
import { generateEtsySynthetic } from "./etsy-synthetic";

describe("etsy-normalizer", () => {
  describe("yardımcılar", () => {
    it("etsyMoney amount/divisor → ondalık string", () => {
      expect(etsyMoney({ amount: 1999, divisor: 100, currency_code: "USD" })).toBe("19.99");
      expect(etsyMoney({ amount: 500, divisor: 100 })).toBe("5.00");
      expect(etsyMoney(null)).toBeNull();
      expect(etsyMoney({ currency_code: "USD" })).toBeNull();
    });

    it("etsyTs unix saniye → Date", () => {
      const d = etsyTs(1735689600);
      expect(d).toBeInstanceOf(Date);
      expect(d?.toISOString()).toBe("2025-01-01T00:00:00.000Z");
      expect(etsyTs(null)).toBeNull();
    });
  });

  describe("listing → product", () => {
    it("fiyat, sku ve durum doğru eşlenir", () => {
      const [listing] = generateEtsySynthetic("products", "demo-shop");
      const p = normalizeEtsyListing(listing);
      expect(p.title).toBe("Etsy El Yapımı Ürün 1");
      expect(p.status).toBe("active");
      expect(p.variants).toHaveLength(1);
      expect(p.variants[0]!.price).toBe("24.99");
      expect(p.variants[0]!.sku).toBe("ETSY-SKU-1");
    });
  });

  describe("receipt → order", () => {
    const receipts = generateEtsySynthetic("orders", "demo-shop");

    it("ilk receipt: indirimli, vergili, kargolu toplam", () => {
      // i=0: qty=1, unit=24.99, discount=5 → subtotal 19.99, tax 8% = 1.5992, shipping 5.5
      const o = normalizeEtsyReceipt(receipts[0]!);
      expect(o.currency).toBe("USD");
      expect(o.subtotalPrice).toBe("19.99");
      expect(o.totalDiscounts).toBe("5.00");
      expect(o.totalShipping).toBe("5.50");
      expect(o.lineItems).toHaveLength(1);
      expect(o.lineItems[0]!.quantity).toBe(1);
      expect(o.lineItems[0]!.price).toBe("24.99");
      // i=0 → refunded (i%5===0)
      expect(o.financialStatus).toBe("refunded");
      expect(o.refunds).toHaveLength(1);
      expect(o.transactions[0]!.gateway).toBe("etsy_payments");
    });

    it("refund olmayan receipt paid + iade yok", () => {
      const o = normalizeEtsyReceipt(receipts[1]!);
      expect(o.financialStatus).toBe("paid");
      expect(o.refunds).toHaveLength(0);
      expect(o.totalRefunded).toBeNull();
    });

    it("line item totalAmount = price * qty", () => {
      const o = normalizeEtsyReceipt(receipts[2]!);
      const li = o.lineItems[0]!;
      expect(li.totalAmount).toBe((Number(li.price) * li.quantity).toFixed(2));
    });
  });

  describe("buyer → customer", () => {
    it("e-posta ve harcama eşlenir", () => {
      const [buyer] = generateEtsySynthetic("customers", "demo-shop");
      const c = normalizeEtsyBuyer(buyer);
      expect(c.email).toBe("etsybuyer1@example.com");
      expect(c.totalSpent).toBe("60.00");
      expect(c.ordersCount).toBe(1);
    });
  });

  describe("determinizm", () => {
    it("aynı shop → aynı id'ler (idempotent)", () => {
      const a = generateEtsySynthetic("orders", "demo-shop");
      const b = generateEtsySynthetic("orders", "demo-shop");
      expect(normalizeEtsyReceipt(a[0]!).externalId).toBe(
        normalizeEtsyReceipt(b[0]!).externalId,
      );
    });
  });
});
