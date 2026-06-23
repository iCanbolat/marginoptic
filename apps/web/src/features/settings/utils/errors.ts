import { ApiError } from "@/lib/errors";

/** ApiError mesajını okunur tek satıra çevirir (yoksa fallback). */
export function errMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}
