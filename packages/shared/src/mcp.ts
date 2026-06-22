import { z } from "zod";

/**
 * Faz 8 — MCP (Model Context Protocol) sözleşmesi (API ⇄ web ortak).
 * Per-org API key ile yetkilendirilen, salt-okunur analytics tool seti.
 * `api_keys` tablosu: ham anahtar yalnız oluşturmada bir kez döner; DB'de sha256 hash saklanır.
 */

/** API key kapsamları — her MCP tool'u bir kapsam gerektirir (scope seçimi). */
export const MCP_SCOPES = [
  "stores:read",
  "profit:read",
  "products:read",
  "ads:read",
] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

/** UI'da kapsam açıklamaları (hangi tool'ları açar). */
export const MCP_SCOPE_DESCRIPTIONS: Record<McpScope, string> = {
  "stores:read": "Mağazaları listele (list_stores)",
  "profit:read": "Kâr özeti / P&L / dönem karşılaştırma (get_profit_summary, get_pnl, compare_periods)",
  "products:read": "Ürün kârlılık sıralaması (top_products_by_profit)",
  "ads:read": "Reklam performansı — ROAS/POAS (get_ad_performance)",
};

/** Ham API key öneki (oluştururken üretilir; tanıma için saklanır). */
export const MCP_KEY_PREFIX = "chk_";

/** Yeni API key oluşturma girdisi. */
export const apiKeyCreateSchema = z.object({
  name: z.string().trim().min(1, "Ad gerekli").max(120),
  scopes: z
    .array(z.enum(MCP_SCOPES))
    .min(1, "En az bir kapsam seçilmeli")
    .refine((s) => new Set(s).size === s.length, "Yinelenen kapsam"),
});
export type ApiKeyCreateInput = z.infer<typeof apiKeyCreateSchema>;

/** API key özeti (ham anahtar olmadan; liste/yönetim için). */
export interface ApiKeySummary {
  id: string;
  name: string;
  /** Ham anahtarın ilk birkaç karakteri (örn. `chk_a1b2c3…`) — tanıma için. */
  keyPrefix: string;
  scopes: McpScope[];
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

/** Oluşturma yanıtı: ham anahtar yalnız burada bir kez döner. */
export interface ApiKeyCreatedResponse extends ApiKeySummary {
  /** Ham anahtar — bir daha gösterilmez; güvenli sakla. */
  key: string;
}
