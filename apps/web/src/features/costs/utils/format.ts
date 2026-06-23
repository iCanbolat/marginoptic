/** İki sınırlı aralığı `min – max` biçiminde gösterir (her ikisi de boşsa "—"). */
export function range(min: number | null, max: number | null, unit = ""): string {
  if (min == null && max == null) return "—";
  return `${min ?? "0"} – ${max ?? "∞"}${unit}`;
}

/** ISO bugünü (yyyy-MM-dd). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * RHF `register(..., { setValueAs })` için sayısal alan dönüştürücü: boş string
 * → undefined (opsiyonel/zod default için), aksi halde Number. Coerce edilen
 * (`z.coerce.number()`) alanların `z.input` tipi `number` olduğundan, metin
 * input'unu sayıya çevirmek gerekir.
 */
export const numberFromInput = (v: unknown): number | undefined =>
  v === "" || v == null ? undefined : Number(v);

/**
 * RHF `setValueAs` için opsiyonel metin dönüştürücü: trim'lenip boşsa undefined
 * döner. Böylece zod `.optional()` alanlar boş input'ta "" yerine undefined alır
 * (regex/min(1) doğrulamaları boş değeri yanlış reddetmez).
 */
export const optionalText = (v: unknown): string | undefined => {
  const s = String(v ?? "").trim();
  return s === "" ? undefined : s;
};
