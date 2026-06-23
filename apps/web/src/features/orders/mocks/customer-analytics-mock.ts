import type {
  CustomerCacResponse,
  CustomerCohortsResponse,
  CustomerLtvResponse,
} from "@churnify/shared";

/**
 * Müşteri analitiği (LTV / CAC / kohort) için deterministik sahte veri.
 * `VITE_MOCK_ORDERS=true` iken backend olmadan KPI kartları + "Lifetime Value"
 * grafiğini beslemek için kullanılır. Sayılar tasarım ekranıyla eşleştirildi.
 */

const CURRENCY = "USD";
const f4 = (n: number): string => n.toFixed(4);

const CUSTOMER_COUNT = 2119;
const REPEAT_RATE = 5.57; // %
const RETURNING = Math.round((CUSTOMER_COUNT * REPEAT_RATE) / 100); // ~118
const NEW_CUSTOMERS = CUSTOMER_COUNT - RETURNING;
const LTV = 50.06; // müşteri başı ortalama ciro (LTV vekili)
const CAC = 24.47;

export function mockLtv(range: { from: string; to: string }): CustomerLtvResponse {
  return {
    from: range.from,
    to: range.to,
    currency: CURRENCY,
    customerCount: CUSTOMER_COUNT,
    newCustomers: NEW_CUSTOMERS,
    returningCustomers: RETURNING,
    repeatRate: REPEAT_RATE,
    avgOrderValue: f4(47.5),
    avgOrdersPerCustomer: 1.06,
    avgRevenuePerCustomer: f4(LTV),
    topCustomers: Array.from({ length: 5 }, (_, i) => ({
      storeId: "00000000-0000-4000-8000-000000000001",
      customerExternalId: String(9100 + i),
      email: `vip${i + 1}@example.com`,
      orders: 6 - i,
      revenue: f4(420 - i * 55),
    })),
  };
}

export function mockCac(range: { from: string; to: string }): CustomerCacResponse {
  return {
    from: range.from,
    to: range.to,
    currency: CURRENCY,
    adSpend: f4(CAC * NEW_CUSTOMERS),
    newCustomers: NEW_CUSTOMERS,
    cac: f4(CAC),
  };
}

// Tasarımdaki kohortlar: Oca..May, üçgen düzen (her ay bir önceki kadar veri).
const COHORT_SIZES = [361, 611, 570, 455, 76];
// Müşteri başı kümülatif LTV artışları (ay indeksine göre): ~$30 → ~$50.
const PER_CUSTOMER_DELTA = [30, 8, 5, 4, 3];
// Ay bazında aktif (tekrar eden) müşteri oranı.
const RETENTION_PCT = [100, 18, 12, 9, 7];

export function mockCohorts(range: {
  from: string;
  to: string;
}): CustomerCohortsResponse {
  const year = Number(range.from.slice(0, 4)) || 2026;

  const cohorts = COHORT_SIZES.map((size, monthIdx) => {
    // Oca için 5 ay, Şub için 4 ... May için 1 ay verisi mevcut.
    const monthsAvailable = COHORT_SIZES.length - monthIdx;
    const cells = Array.from({ length: monthsAvailable }, (_, i) => {
      const retentionPct = RETENTION_PCT[i] ?? 0;
      return {
        monthIndex: i,
        customers: Math.round((size * retentionPct) / 100),
        revenue: f4(PER_CUSTOMER_DELTA[i] * size),
        retentionPct,
      };
    });
    const month = String(monthIdx + 1).padStart(2, "0");
    return { cohort: `${year}-${month}`, size, cells };
  });

  return { from: range.from, to: range.to, cohorts };
}
