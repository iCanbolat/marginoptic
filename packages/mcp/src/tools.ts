import { z } from "zod";
import {
  AD_LEVELS,
  analyticsFilterSchema,
  type AdLevel,
  type McpScope,
} from "@churnify/shared";
import type { McpDataProvider, McpToolContext } from "./provider.js";

/** MCP istemcisinden gelen ham argümanlar (SDK inputSchema'ya göre doğrular). */
type RawArgs = Record<string, unknown>;

/** Bir MCP tool tanımı: ad + gerektirdiği kapsam + şema + provider'a delege handler. */
export interface McpToolDef {
  name: string;
  /** Bu tool'u açan kapsam (key'in scopes'unda yoksa kaydedilmez). */
  scope: McpScope;
  title: string;
  description: string;
  /** İstemciye ilan edilen giriş şeması (zod raw shape). */
  inputSchema: z.ZodRawShape;
  handler: (
    provider: McpDataProvider,
    ctx: McpToolContext,
    args: RawArgs,
  ) => Promise<unknown>;
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-MM-DD biçiminde olmalı");

const storeIdsField = z
  .array(z.string().uuid())
  .optional()
  .describe("Mağaza ID'leri (UUID); boş bırakılırsa org'un tüm mağazaları kullanılır.");

/** from + to + storeIds — analytics okumalarının ortak şekli. */
const dateRangeShape = {
  from: isoDate.describe("Başlangıç tarihi (YYYY-MM-DD)"),
  to: isoDate.describe("Bitiş tarihi (YYYY-MM-DD; from'a eşit veya sonra)"),
  storeIds: storeIdsField,
} satisfies z.ZodRawShape;

/** Ham argümanları paylaşılan analytics filtresine indirger (tek doğrulama kaynağı). */
function parseFilter(args: RawArgs) {
  return analyticsFilterSchema.parse({
    from: args.from,
    to: args.to,
    storeIds: args.storeIds,
    compare: args.compare,
  });
}

function clampLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 10;
  return Math.min(50, Math.max(1, Math.trunc(n)));
}

function parseLevel(raw: unknown): AdLevel {
  return (AD_LEVELS as readonly string[]).includes(String(raw))
    ? (raw as AdLevel)
    : "campaign";
}

/**
 * Salt-okunur analytics tool seti (PLAN §5). Her tool bir kapsam gerektirir;
 * key'in kapsamları handler kaydını filtreler.
 */
export const MCP_TOOLS: McpToolDef[] = [
  {
    name: "list_stores",
    scope: "stores:read",
    title: "Mağazaları listele",
    description:
      "Organizasyondaki tüm mağazaları döner (id, ad, para birimi, kanal). Diğer tool'larda storeIds için kullanılır.",
    inputSchema: {},
    handler: (provider, ctx) => provider.listStores(ctx),
  },
  {
    name: "get_profit_summary",
    scope: "profit:read",
    title: "Kâr özeti",
    description:
      "Tarih aralığı için ciro, net kâr, marj, blended ROAS/POAS ve sipariş/units toplamları. compare=true ile bir önceki eşit-uzunlukta dönem + yüzde değişimleri döner.",
    inputSchema: {
      ...dateRangeShape,
      compare: z
        .boolean()
        .optional()
        .describe("Önceki eşit-uzunlukta dönemle karşılaştır (varsayılan false)."),
    },
    handler: (provider, ctx, args) =>
      provider.getProfitSummary(ctx, parseFilter(args)),
  },
  {
    name: "get_pnl",
    scope: "profit:read",
    title: "Gelir tablosu (P&L)",
    description:
      "Brüt satıştan net kâra satır-satır gelir tablosu; her gider satırının ciroya oranını (%) içerir.",
    inputSchema: { ...dateRangeShape },
    handler: (provider, ctx, args) => provider.getPnl(ctx, parseFilter(args)),
  },
  {
    name: "top_products_by_profit",
    scope: "products:read",
    title: "Net kâra göre ürünler",
    description:
      "Net kâra göre sıralı en kârlı ürünler (units, ciro, COGS, atfedilen reklam harcaması, net kâr).",
    inputSchema: {
      ...dateRangeShape,
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Döndürülecek ürün sayısı (1-50, varsayılan 10)."),
    },
    handler: (provider, ctx, args) =>
      provider.topProductsByProfit(ctx, parseFilter(args), clampLimit(args.limit)),
  },
  {
    name: "get_ad_performance",
    scope: "ads:read",
    title: "Reklam performansı",
    description:
      "Reklam harcaması, dönüşüm değeri, platform ROAS ve blended ROAS/POAS; sağlayıcı/kampanya kırılımı ve gün serisi.",
    inputSchema: {
      ...dateRangeShape,
      level: z
        .string()
        .optional()
        .describe("Kırılım seviyesi: campaign | adset | ad (varsayılan campaign)."),
    },
    handler: (provider, ctx, args) =>
      provider.getAdPerformance(ctx, parseFilter(args), parseLevel(args.level)),
  },
  {
    name: "compare_periods",
    scope: "profit:read",
    title: "Dönem karşılaştırma",
    description:
      "İki tarih aralığının (A güncel, B önceki) kâr toplamlarını ve A→B yüzde değişimlerini karşılaştırır.",
    inputSchema: {
      aFrom: isoDate.describe("A dönemi başlangıç (güncel dönem)."),
      aTo: isoDate.describe("A dönemi bitiş."),
      bFrom: isoDate.describe("B dönemi başlangıç (önceki/karşılaştırma dönemi)."),
      bTo: isoDate.describe("B dönemi bitiş."),
      storeIds: storeIdsField,
    },
    handler: (provider, ctx, args) => {
      const a = analyticsFilterSchema.parse({
        from: args.aFrom,
        to: args.aTo,
        storeIds: args.storeIds,
      });
      const b = analyticsFilterSchema.parse({
        from: args.bFrom,
        to: args.bTo,
        storeIds: args.storeIds,
      });
      return provider.comparePeriods(
        ctx,
        { from: a.from, to: a.to },
        { from: b.from, to: b.to },
        a.storeIds,
      );
    },
  },
];
