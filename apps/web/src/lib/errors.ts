/**
 * API hata sözleşmesi — hem fetch tabanlı `lib/api.ts` hem de axios tabanlı
 * `lib/api-client.ts` aynı `ApiError` tipini kullanır. Tek kaynak burası.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly issues?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** API yanıt gövdesinden (`{ error: { message, issues } }`) `ApiError` türetir. */
export function toApiError(
  status: number,
  body: unknown,
  fallback = `İstek başarısız (${status})`,
): ApiError {
  let message = fallback;
  let issues: { path: string; message: string }[] | undefined;
  if (body && typeof body === "object") {
    const err = (body as { error?: unknown }).error ?? body;
    if (err && typeof err === "object") {
      const m = (err as { message?: unknown }).message;
      if (typeof m === "string") message = m;
      const i = (err as { issues?: unknown }).issues;
      if (Array.isArray(i)) issues = i as { path: string; message: string }[];
    }
  }
  return new ApiError(status, message, issues);
}
