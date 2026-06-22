import {
  buildAllocations,
  computeDailyAmount,
  daysInMonth,
  enumerateDays,
  type MaterializableExpense,
} from "./expense-materializer";

const recurring = (
  recurrence: MaterializableExpense["recurrence"],
  over: Partial<MaterializableExpense> = {},
): MaterializableExpense => ({
  type: "recurring",
  recurrence,
  allocation: "store",
  amount: "300",
  startDate: "2026-06-01",
  endDate: null,
  ...over,
});

describe("enumerateDays / daysInMonth", () => {
  it("aralığı dahil olarak açar (ay sınırı dahil)", () => {
    expect(enumerateDays("2026-02-27", "2026-03-02")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });

  it("tek gün → tek eleman", () => {
    expect(enumerateDays("2026-06-10", "2026-06-10")).toEqual(["2026-06-10"]);
  });

  it("ayın gün sayısı (2026 şubat = 28)", () => {
    expect(daysInMonth("2026-02-15")).toBe(28);
    expect(daysInMonth("2026-06-01")).toBe(30);
    expect(daysInMonth("2024-02-01")).toBe(29);
  });
});

describe("computeDailyAmount", () => {
  it("aralık dışını 0 verir", () => {
    const e = recurring("daily", { startDate: "2026-06-05", endDate: "2026-06-10" });
    expect(computeDailyAmount(e, "2026-06-04")).toBe(0);
    expect(computeDailyAmount(e, "2026-06-11")).toBe(0);
    expect(computeDailyAmount(e, "2026-06-05")).toBe(300);
  });

  it("daily = tam tutar her gün", () => {
    expect(computeDailyAmount(recurring("daily"), "2026-06-15")).toBe(300);
  });

  it("weekly = tutar / 7", () => {
    expect(computeDailyAmount(recurring("weekly"), "2026-06-15")).toBeCloseTo(
      300 / 7,
      6,
    );
  });

  it("monthly = tutar / ayın gün sayısı (haziran 30)", () => {
    expect(computeDailyAmount(recurring("monthly"), "2026-06-15")).toBeCloseTo(
      10,
      6,
    );
    // şubat 28 → daha yüksek günlük
    expect(
      computeDailyAmount(recurring("monthly", { startDate: "2026-02-01" }), "2026-02-15"),
    ).toBeCloseTo(300 / 28, 6);
  });

  it("one_time yalnız başlangıç gününde tutarı verir", () => {
    const e: MaterializableExpense = {
      type: "one_time",
      recurrence: null,
      allocation: "store",
      amount: "500",
      startDate: "2026-06-10",
      endDate: null,
    };
    expect(computeDailyAmount(e, "2026-06-10")).toBe(500);
    expect(computeDailyAmount(e, "2026-06-11")).toBe(0);
  });
});

describe("buildAllocations", () => {
  it("tek mağaza, daily: her güne bir satır", () => {
    const rows = buildAllocations(
      recurring("daily", { amount: "30" }),
      "2026-06-01",
      "2026-06-03",
      ["s1"],
    );
    expect(rows).toEqual([
      { storeId: "s1", date: "2026-06-01", amount: "30.0000" },
      { storeId: "s1", date: "2026-06-02", amount: "30.0000" },
      { storeId: "s1", date: "2026-06-03", amount: "30.0000" },
    ]);
  });

  it("spread: günlük tutar mağazalara eşit bölünür", () => {
    const rows = buildAllocations(
      recurring("daily", { amount: "30", allocation: "spread" }),
      "2026-06-01",
      "2026-06-01",
      ["a", "b", "c"],
    );
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.amount === "10.0000")).toBe(true);
  });

  it("one_time: yalnız başlangıç günü yazılır, diğer günler atlanır", () => {
    const rows = buildAllocations(
      {
        type: "one_time",
        recurrence: null,
        allocation: "store",
        amount: "500",
        startDate: "2026-06-02",
        endDate: null,
      },
      "2026-06-01",
      "2026-06-04",
      ["s1"],
    );
    expect(rows).toEqual([
      { storeId: "s1", date: "2026-06-02", amount: "500.0000" },
    ]);
  });

  it("mağaza yoksa boş döner", () => {
    expect(buildAllocations(recurring("daily"), "2026-06-01", "2026-06-02", [])).toEqual(
      [],
    );
  });
});
