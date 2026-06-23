import { useQuery } from "@tanstack/react-query";
import type { AnalyticsFilterParams } from "@/lib/api";
import { customerAnalyticsApi } from "../api/customer-analytics-api";

/**
 * Müşteri analitiği hook'ları (LTV / CAC / kohort).
 * `customerAnalyticsApi` üzerinden gider (mock modunda sahte veri, aksi halde
 * paylaşılan analitik istemcisi); dashboard'daki `use-analytics.ts` desenini izler.
 */

const keyOf = (name: string, f: AnalyticsFilterParams) => [
  "analytics",
  name,
  f.from,
  f.to,
  (f.storeIds ?? []).join(","),
  f.compare ?? false,
];

const STALE = 60_000;

export function useCustomerLtv(f: AnalyticsFilterParams, enabled = true) {
  return useQuery({
    queryKey: keyOf("ltv", f),
    queryFn: () => customerAnalyticsApi.ltv(f),
    enabled,
    staleTime: STALE,
  });
}

export function useCustomerCac(f: AnalyticsFilterParams, enabled = true) {
  return useQuery({
    queryKey: keyOf("cac", f),
    queryFn: () => customerAnalyticsApi.cac(f),
    enabled,
    staleTime: STALE,
  });
}

export function useCustomerCohorts(f: AnalyticsFilterParams, enabled = true) {
  return useQuery({
    queryKey: keyOf("cohorts", f),
    queryFn: () => customerAnalyticsApi.cohorts(f),
    enabled,
    staleTime: STALE,
  });
}
