import { z } from "zod";

/** Uygulama ortam değişkenleri şeması — tüm config tek kaynaktan ve tip-güvenli. */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),

  REDIS_HOST: z.string().min(1).default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),

  // Auth (Faz 1)
  JWT_ACCESS_SECRET: z.string().min(8).default("dev-access-secret-change-me"),
  JWT_REFRESH_SECRET: z.string().min(8).default("dev-refresh-secret-change-me"),

  // AES-256-GCM için 32 byte (64 hex) anahtar (Faz 2)
  TOKEN_ENCRYPTION_KEY: z.string().length(64).default("0".repeat(64)),

  // Entegrasyonlar (Faz 2). API'nin herkese açık kök URL'i (OAuth redirect + webhook).
  APP_URL: z.string().url().default("http://localhost:3000"),
  SHOPIFY_API_KEY: z.string().default(""),
  SHOPIFY_API_SECRET: z.string().default(""),
  SHOPIFY_SCOPES: z
    .string()
    .default("read_orders,read_products,read_customers,read_inventory,read_fulfillments"),
  SHOPIFY_API_VERSION: z.string().default("2025-01"),

  // Kâr motoru / FX (Faz 5). FX_API_URL verilirse fx-rates job günlük kur çeker;
  // verilmezse FX güncelleme no-op (aynı para birimi çevrimi kodda 1).
  FX_API_URL: z.string().url().optional(),
  FX_BASE_CURRENCY: z.string().length(3).optional(),

  // Reklam entegrasyonları (Faz 6) — gerçek OAuth için doldurulur; dev-connect
  // sentetik veri kullanır (kimlik gerekmez).
  META_APP_ID: z.string().default(""),
  META_APP_SECRET: z.string().default(""),
  GOOGLE_ADS_CLIENT_ID: z.string().default(""),
  GOOGLE_ADS_CLIENT_SECRET: z.string().default(""),
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().default(""),
  TIKTOK_APP_ID: z.string().default(""),
  TIKTOK_APP_SECRET: z.string().default(""),


  // eBay (Faz 10) — OAuth2 authorization code, Sell API. Anahtar yoksa canlı OAuth
  // kapalı; dev-connect (sentetik) yine çalışır. Tazelik zamanlanmış polling ile.
  EBAY_CLIENT_ID: z.string().default(""),
  EBAY_CLIENT_SECRET: z.string().default(""),
  EBAY_SCOPES: z
    .string()
    .default(
      "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
    ),
  // "production" | "sandbox" — connector endpoint'lerini seçer.
  EBAY_ENV: z.enum(["production", "sandbox"]).default("production"),

  // Amazon (Faz 10) — Selling Partner API (SP-API), Login with Amazon (LWA). SP-API
  // artık AWS SigV4 imzası istemez (yalnız LWA access token). Anahtar yoksa canlı OAuth
  // kapalı; dev-connect (sentetik) yine çalışır.
  AMAZON_LWA_CLIENT_ID: z.string().default(""),
  AMAZON_LWA_CLIENT_SECRET: z.string().default(""),
  AMAZON_SCOPES: z.string().default(""),
  // SP-API bölgesi: na (Kuzey Amerika), eu (Avrupa), fe (Uzak Doğu).
  AMAZON_REGION: z.enum(["na", "eu", "fe"]).default("na"),

  // Faturalandırma — creem.io (Faz 9). Anahtar boşsa **dev sentetik** mod
  // (gerçek HTTP yok; checkout/portal dev sayfasına döner, webhook yerine
  // POST /billing/dev-activate ile plan etkinleştirilir). Test ucu:
  // https://test-api.creem.io ; prod: https://api.creem.io
  CREEM_API_URL: z.string().url().default("https://api.creem.io"),
  CREEM_API_KEY: z.string().default(""),
  CREEM_WEBHOOK_SECRET: z.string().default(""),
  // Plan → Creem ürün eşlemesi (14 günlük deneme Creem ürününde ayarlı).
  CREEM_PRODUCT_BASIC: z.string().default(""),
  CREEM_PRODUCT_PRO: z.string().default(""),
});

export type Env = z.infer<typeof envSchema>;

/** ConfigModule.forRoot({ validate }) ile kullanılır; hata varsa uygulama açılmaz. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Geçersiz ortam değişkenleri:\n${issues}`);
  }
  return parsed.data;
}
