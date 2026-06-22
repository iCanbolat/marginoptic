import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** "az önce" / "5 dk önce" / "2 sa önce" / "3 gün önce" biçiminde göreli zaman. */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 45) return "az önce";
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min} dk önce`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.round(hr / 24);
  return `${day} gün önce`;
}

/** Para string'ini (DB numeric) yerele biçimler; null → "—". */
export function formatMoney(
  amount: string | null,
  currency: string | null,
): string {
  if (amount == null) return "—";
  const n = Number(amount);
  if (Number.isNaN(n)) return amount;
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: currency ?? "USD",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency ?? ""}`.trim();
  }
}
