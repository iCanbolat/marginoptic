import type { Feature, PlanEntitlement } from "@churnify/shared";
import { useAuthStore } from "./store";

/** Mevcut kullanıcının plan entitlement'ı (me() yüklenene kadar null). */
export function usePlan(): PlanEntitlement | null {
  return useAuthStore((s) => s.entitlement);
}

/** Bir Pro özelliğine erişim var mı (entitlement yüklenmediyse false). */
export function useFeature(feature: Feature): boolean {
  return useAuthStore((s) => s.entitlement?.features[feature] ?? false);
}

/** Plan henüz bilinmiyor mu (me() yüklenene kadar true). */
export function usePlanLoading(): boolean {
  return useAuthStore((s) => s.entitlement === null);
}
