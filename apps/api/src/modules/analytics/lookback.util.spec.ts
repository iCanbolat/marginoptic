import { clampFromToLookback } from "./lookback.util";

describe("clampFromToLookback", () => {
  const today = new Date("2026-06-27T12:00:00.000Z");

  it("pencere içindeki from'u değiştirmez", () => {
    expect(clampFromToLookback("2026-01-01", 365, today)).toBe("2026-01-01");
  });

  it("çok eski from'u en eski izinli tarihe çeker (Basic = 365 gün)", () => {
    expect(clampFromToLookback("2024-01-01", 365, today)).toBe("2025-06-27");
  });

  it("tam sınırdaki from'u korur", () => {
    expect(clampFromToLookback("2025-06-27", 365, today)).toBe("2025-06-27");
  });

  it("Pro penceresinde (730 gün) daha geriye izin verir", () => {
    expect(clampFromToLookback("2024-08-01", 730, today)).toBe("2024-08-01");
    expect(clampFromToLookback("2023-01-01", 730, today)).toBe("2024-06-27");
  });
});
