import { createHash, randomBytes } from "node:crypto";

/**
 * Ham anahtar öneki — `@churnify/shared` `MCP_KEY_PREFIX` ile aynı.
 * Burada yerel tutulur ki bu modül saf (shared runtime importu yok) ve jest birim
 * testlerinde doğrudan yüklenebilir kalsın (repo konvansiyonu).
 */
const KEY_PREFIX = "chk_";

/** Üretilen ham anahtar + saklanacak türevleri. Ham anahtar yalnız bir kez döner. */
export interface GeneratedApiKey {
  /** Ham anahtar (kullanıcıya bir kez gösterilir, asla saklanmaz). */
  raw: string;
  /** sha256(raw) hex — DB'de saklanır, lookup anahtarı. */
  keyHash: string;
  /** Ham anahtarın ilk 12 karakteri — tanıma için (örn. "chk_a1b2c3d"). */
  keyPrefix: string;
}

/** Ham anahtarı sha256 ile özetler (deterministik; verify lookup'ında kullanılır). */
export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Kriptografik olarak güçlü yeni bir API key üretir (`chk_<base64url(24 byte)>`). */
export function generateApiKey(): GeneratedApiKey {
  const raw = `${KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
  return { raw, keyHash: hashApiKey(raw), keyPrefix: raw.slice(0, 12) };
}
