import { evaluateFormula, validateFormula } from "./custom-metric";

const FIELDS = ["revenue", "cogs", "adSpend", "netProfit", "ordersCount"];

describe("custom-metric formula", () => {
  describe("validateFormula", () => {
    it("geçerli formülü kabul eder ve alanları toplar", () => {
      const r = validateFormula("(revenue - cogs) / ordersCount", FIELDS);
      expect(r.ok).toBe(true);
      expect(r.fields.sort()).toEqual(["cogs", "ordersCount", "revenue"]);
    });

    it("bilinmeyen alanı reddeder", () => {
      const r = validateFormula("revenue - foo", FIELDS);
      expect(r.ok).toBe(false);
      expect(r.error).toContain("foo");
    });

    it("geçersiz sözdizimini reddeder", () => {
      expect(validateFormula("revenue +", FIELDS).ok).toBe(false);
      expect(validateFormula("(revenue", FIELDS).ok).toBe(false);
      expect(validateFormula("revenue cogs", FIELDS).ok).toBe(false);
    });

    it("eval enjeksiyonunu reddeder (kod çalıştırmaz)", () => {
      expect(validateFormula("process.exit(1)", FIELDS).ok).toBe(false);
      expect(validateFormula("revenue; drop table", FIELDS).ok).toBe(false);
    });
  });

  describe("evaluateFormula", () => {
    const values = {
      revenue: 1000,
      cogs: 300,
      adSpend: 200,
      netProfit: 250,
      ordersCount: 10,
    };

    it("aritmetik önceliğe uyar", () => {
      expect(evaluateFormula("revenue - cogs * 2", values)).toBe(400);
      expect(evaluateFormula("(revenue - cogs) * 2", values)).toBe(1400);
    });

    it("bölme ve birleşik ifade", () => {
      expect(evaluateFormula("netProfit / revenue * 100", values)).toBe(25);
      expect(evaluateFormula("revenue / ordersCount", values)).toBe(100);
    });

    it("tekli eksi", () => {
      expect(evaluateFormula("-revenue + cogs", values)).toBe(-700);
    });

    it("sıfıra bölme → null", () => {
      expect(evaluateFormula("revenue / 0", values)).toBeNull();
      expect(
        evaluateFormula("revenue / ordersCount", { ...values, ordersCount: 0 }),
      ).toBeNull();
    });

    it("eksik alan → null", () => {
      expect(evaluateFormula("revenue - missing", values)).toBeNull();
    });

    it("sabit sayılarla çalışır", () => {
      expect(evaluateFormula("revenue * 0.1", values)).toBeCloseTo(100);
    });
  });
});
