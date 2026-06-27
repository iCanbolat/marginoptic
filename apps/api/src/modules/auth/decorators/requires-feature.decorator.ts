import { SetMetadata } from "@nestjs/common";
import type { Feature } from "@churnify/shared";

export const REQUIRES_FEATURE_KEY = "requiresFeature";

/**
 * Bir endpoint'i belirli bir Pro özelliğine bağlar; `RequiresFeatureGuard` plan
 * entitlement'ına göre uygular. Handler veya controller seviyesinde kullanılabilir.
 */
export const RequiresFeature = (feature: Feature) =>
  SetMetadata(REQUIRES_FEATURE_KEY, feature);
