import type {
  CustomerCacResponse,
  CustomerCohortsResponse,
  CustomerLtvResponse,
} from "@churnify/shared";
import { analyticsApi, type AnalyticsFilterParams } from "@/lib/api";

/**
 * Müşteri analitiği DAL — paylaşılan org-scoped `analyticsApi` istemcisini
 * (lib/api.ts) çağırır.
 */
export const customerAnalyticsApi = {
  ltv: (f: AnalyticsFilterParams): Promise<CustomerLtvResponse> =>
    analyticsApi.ltv(f),
  cac: (f: AnalyticsFilterParams): Promise<CustomerCacResponse> =>
    analyticsApi.cac(f),
  cohorts: (f: AnalyticsFilterParams): Promise<CustomerCohortsResponse> =>
    analyticsApi.cohorts(f),
};
