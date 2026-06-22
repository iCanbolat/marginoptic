import {
  dailyNetProfit,
  emptyDaily,
  orderNetContribution,
  profitMargin,
  round4,
  type DailyMetricsAccumulator,
} from "./contribution";

describe("round4", () => {
  it("4 ondalığa yuvarlar ve -0'ı temizler", () => {
    expect(round4(1.234567)).toBe(1.2346);
    expect(round4(0.1 + 0.2)).toBe(0.3);
    expect(round4(-0)).toBe(0);
    expect(round4(10)).toBe(10);
  });
});

describe("orderNetContribution (Bölüm 2.4)", () => {
  it("tüm kalemleri brüt satıştan düşer", () => {
    // gross 39.98 − disc 5 − refund 0 − cogs 17 − kargo 4 − ücret 1.5 − vergi 0 = 12.48
    const net = orderNetContribution({
      grossSales: 39.98,
      discounts: 5,
      refunds: 0,
      cogs: 17,
      shippingCost: 4,
      paymentFees: 1.5,
      taxBorne: 0,
    });
    expect(net).toBe(12.48);
  });

  it("tam iade siparişi negatif katkı verir (maliyetler kalır)", () => {
    const net = orderNetContribution({
      grossSales: 50,
      discounts: 0,
      refunds: 50,
      cogs: 20,
      shippingCost: 5,
      paymentFees: 1.75,
      taxBorne: 0,
    });
    expect(net).toBe(round4(-26.75));
  });

  it("üstlenilen satış vergisini düşer", () => {
    const base = {
      grossSales: 100,
      discounts: 0,
      refunds: 0,
      cogs: 40,
      shippingCost: 0,
      paymentFees: 0,
    };
    expect(orderNetContribution({ ...base, taxBorne: 0 })).toBe(60);
    expect(orderNetContribution({ ...base, taxBorne: 8 })).toBe(52);
  });
});

describe("dailyNetProfit", () => {
  it("sipariş katkıları toplamından blended giderleri düşer", () => {
    const a: DailyMetricsAccumulator = {
      ...emptyDaily(),
      revenue: 200,
      discounts: 10,
      refunds: 0,
      cogs: 80,
      shippingCost: 8,
      paymentFees: 6,
      taxes: 0,
      adSpend: 25, // reklam (Faz 6)
      customExpenses: 10, // dağıtılmış özel gider
      ordersCount: 3,
      units: 5,
    };
    // 200 − 10 − 0 − 80 − 8 − 6 − 0 − 25 − 10 = 61
    expect(dailyNetProfit(a)).toBe(61);
  });
});

describe("profitMargin", () => {
  it("net/ciro yüzdesi", () => {
    expect(profitMargin(61, 200)).toBe(30.5);
  });
  it("ciro 0 → null", () => {
    expect(profitMargin(0, 0)).toBeNull();
  });
});
