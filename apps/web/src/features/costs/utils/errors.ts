import { ApiError } from "@/lib/errors";

/** ApiError mesajını (varsa zod issue'larıyla) okunur tek satıra çevirir. */
export function errMsg(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    return e.issues?.length
      ? `${e.message}: ${e.issues.map((i) => i.message).join(", ")}`
      : e.message;
  }
  return fallback;
}
