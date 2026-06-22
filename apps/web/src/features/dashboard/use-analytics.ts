import { useQuery } from "@tanstack/react-query";
import type { AdLevel } from "@churnify/shared";
import { analyticsApi, type AnalyticsFilterParams } from "@/lib/api";

/** Pano global filtresi (tarih aralığı + mağaza alt kümesi + karşılaştırma). */
export interface DashFilter {
  from: string;
  to: string;
  storeIds: string[];
  compare: boolean;
}

export function toParams(
  f: DashFilter,
  override?: { from: string; to: string } | null,
): AnalyticsFilterParams {
  return {
    from: override?.from ?? f.from,
    to: override?.to ?? f.to,
    storeIds: f.storeIds,
    compare: f.compare,
  };
}

const keyOf = (
  name: string,
  f: AnalyticsFilterParams,
  extra?: string | number,
) => [
  "analytics",
  name,
  f.from,
  f.to,
  (f.storeIds ?? []).join(","),
  f.compare ?? false,
  extra ?? null,
];

const STALE = 60_000;

export function useProfitSummary(f: AnalyticsFilterParams, enabled = true) {
  return useQuery({
    queryKey: keyOf("profit-summary", f),
    queryFn: () => analyticsApi.profitSummary(f),
    enabled,
    staleTime: STALE,
  });
}

export function useTimeseries(f: AnalyticsFilterParams, enabled = true) {
  return useQuery({
    queryKey: keyOf("timeseries", f),
    queryFn: () => analyticsApi.timeseries(f),
    enabled,
    staleTime: STALE,
  });
}

export function usePnl(f: AnalyticsFilterParams, enabled = true) {
  return useQuery({
    queryKey: keyOf("pnl", f),
    queryFn: () => analyticsApi.pnl(f),
    enabled,
    staleTime: STALE,
  });
}

export function useProducts(
  f: AnalyticsFilterParams,
  limit: number,
  enabled = true,
) {
  return useQuery({
    queryKey: keyOf("products", f, limit),
    queryFn: () => analyticsApi.products(f, limit),
    enabled,
    staleTime: STALE,
  });
}

export function useAdsPerformance(
  f: AnalyticsFilterParams,
  level: AdLevel,
  enabled = true,
) {
  return useQuery({
    queryKey: keyOf("ads", f, level),
    queryFn: () => analyticsApi.adsPerformance(f, level),
    enabled,
    staleTime: STALE,
  });
}

export function useStoreComparison(f: AnalyticsFilterParams, enabled = true) {
  return useQuery({
    queryKey: keyOf("store-comparison", f),
    queryFn: () => analyticsApi.storeComparison(f),
    enabled,
    staleTime: STALE,
  });
}

export function useCustomMetricValues(f: AnalyticsFilterParams, enabled = true) {
  return useQuery({
    queryKey: keyOf("custom-metric-values", f),
    queryFn: () => analyticsApi.customMetricValues(f),
    enabled,
    staleTime: STALE,
  });
}
