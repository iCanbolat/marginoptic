import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className merge (same helper as apps/web). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** USD money formatter for mock figures. */
export function usd(amount: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
  }).format(amount);
}

/** Compact USD (e.g. $12.4k) for tight KPI tiles. */
export function usdCompact(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}
