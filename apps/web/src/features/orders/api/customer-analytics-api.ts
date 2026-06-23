import type {
  CustomerCacResponse,
  CustomerCohortsResponse,
  CustomerLtvResponse,
} from "@churnify/shared";
import { analyticsApi, type AnalyticsFilterParams } from "@/lib/api";
import { USE_MOCK_ORDERS } from "../mocks/orders-mock";
import {
  mockCac,
  mockCohorts,
  mockLtv,
} from "../mocks/customer-analytics-mock";

/**
 * Müşteri analitiği DAL — `VITE_MOCK_ORDERS=true` ise sahte veri, aksi halde
 * paylaşılan org-scoped `analyticsApi` istemcisini (lib/api.ts) çağırır.
 */
export const customerAnalyticsApi = {
  ltv: (f: AnalyticsFilterParams): Promise<CustomerLtvResponse> =>
    USE_MOCK_ORDERS ? Promise.resolve(mockLtv(f)) : analyticsApi.ltv(f),

  cac: (f: AnalyticsFilterParams): Promise<CustomerCacResponse> =>
    USE_MOCK_ORDERS ? Promise.resolve(mockCac(f)) : analyticsApi.cac(f),

  cohorts: (f: AnalyticsFilterParams): Promise<CustomerCohortsResponse> =>
    USE_MOCK_ORDERS ? Promise.resolve(mockCohorts(f)) : analyticsApi.cohorts(f),
};
