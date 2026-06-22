# Churnify — Çok Kanallı "Gerçek Net Kâr" Dashboard

> TrueProfit benzeri SaaS: çoklu mağaza (Shopify/Etsy) + reklam + COGS + kargo + işlem ücretleri + iadeler + özel giderler (tek seferlik/yinelenen) dahil **ciro değil net kâr** hesaplayan, özelleştirilebilir, çok kanallı dashboard.

Bu dosya üst-seviye mimari ve fazları özetler. Detaylı, izlenebilir batch listeleri:
- **API track →** [`docs/api-roadmap.md`](docs/api-roadmap.md)
- **Client track →** [`docs/web-roadmap.md`](docs/web-roadmap.md)

---

## 1. Context (Neden / Ne)

**Problem:** Shopify/Etsy satıcıları platform panellerinde ciro görür ama gerçek net kârı göremez. COGS, reklam harcaması, kargo, ödeme komisyonları, iadeler ve sabit/yinelenen giderler dağınık olduğundan "bu ürün/kampanya gerçekten kâr ediyor mu?" sorusu cevapsız kalır.

**Hedef ürün:** Kullanıcı bir organizasyon altında bir veya daha fazla mağaza bağlar; sistem tüm satış + maliyet + reklam verisini çeker, **sipariş bazında katkı payı** hesaplayıp günlük rollup'lara indirger ve gerçek zamanlıya yakın bir **Net Kâr** panosu sunar. Ürün/kampanya/kanal bazında kârlılık, özelleştirilebilir widget'lar ve MCP üzerinden AI analizi sağlar.

**Kapsam kararları (kilitlendi):** Monorepo (pnpm+Turborepo) · React+Vite SPA client · **routing/data: TanStack Router + TanStack Query** · Self-hosted auth (Nest JWT/refresh, Org→Member→Store, RBAC) · **MVP entegrasyonları: Shopify + Meta + Google + TikTok**. Etsy ve diğer kanallar Faz 9'a ertelendi.

---

## 2. Hedef Mimari

### 2.1 Monorepo yerleşimi (Turborepo + pnpm workspaces)

```
churnify/
├─ apps/
│  ├─ api/        ← mevcut Nest 11 scaffold buraya taşınır
│  └─ web/        ← yeni: Vite + React + TS SPA
├─ packages/
│  ├─ shared/     ← zod şemaları + TS tipleri (DTO sözleşmesi), para/tarih util
│  ├─ mcp/        ← MCP server (Streamable HTTP), analytics servislerini sarar
│  └─ config/     ← paylaşılan eslint / tsconfig / prettier
├─ docker-compose.yml   ← postgres + redis (+ bull-board)
├─ turbo.json
└─ pnpm-workspace.yaml
```

### 2.2 Stack

| Katman | Seçim |
|---|---|
| API | NestJS 11, drizzle-orm + `pg` (node-postgres), drizzle-kit (migrations) |
| Auth | passport-jwt (access+refresh), argon2 (parola hash), RBAC guard |
| Kuyruk/Cache | BullMQ + ioredis; `@nestjs/throttler` + `@nest-lab/throttler-storage-redis` |
| Config/Log | `@nestjs/config` + zod env validation, nestjs-pino, helmet |
| API sözleşmesi | `@nestjs/swagger` → OpenAPI; client tipi `packages/shared` (zod) + orval/ts-rest |
| Client | Vite + React + TS, TanStack Router + TanStack Query, Tailwind + shadcn/ui |
| Grafik/Pano | Recharts (veya visx), `react-grid-layout` (sürükle-bırak widget), react-hook-form + zod, zustand |
| MCP | `@modelcontextprotocol/sdk` (Streamable HTTP), per-org API key |

### 2.3 Veri akışı

```
Shopify/Etsy/Ads  --(OAuth)-->  Connector  --enqueue-->  BullMQ (sync queues)
       │                                                      │
   Webhooks ──> webhook queue ──┐                       Worker'lar
                                ▼                             │
                       Postgres (raw + normalized)  <────────┘
                                │
                  metrics-rollup queue (sync sonrası + nightly)
                                ▼
          daily_store_metrics / product_profit_daily  ──> Redis cache
                                │                              │
                       Analytics Module (REST)  ──────────────┘
                          │                  │
                        web SPA            packages/mcp (AI)
```

### 2.4 Kâr hesaplama motoru (çekirdek formül)

```
Net Kâr = Brüt Satış
        − İndirimler − İadeler
        − COGS (+ handling)
        − Kargo maliyeti
        − Ödeme/işlem ücretleri
        − Vergiler (üstlenilen)
        − Reklam harcaması
        − Özel giderler (dağıtılmış)
```

- **Sipariş-bazında çözümlenebilenler** (COGS, kargo, ödeme ücreti, iade, satır indirimi) sipariş katkı payına yazılır.
- **Sipariş-bazında çözümlenemeyenler** (reklam, sabit/yinelenen giderler) gün+mağaza seviyesinde **blended** dağıtılır; ürün kırılımı gerekiyorsa ciro-payı veya UTM ile atfedilir.
- Sonuç `daily_store_metrics` ve `product_profit_daily` rollup tablolarına indirgenir; pano bunları okur (canlı hesap değil).

---

## 3. Veri Modeli (Drizzle / Postgres — özet)

- **Tenant & auth:** `organizations` · `users` · `memberships(org_id,user_id,role)` · `refresh_tokens` · `invitations`
- **Mağaza & entegrasyon:** `stores(org_id, channel, currency, timezone, external_shop_id)` · `integration_connections(provider, status, access_token_enc, refresh_token_enc, token_expires_at, scopes, external_account_id, meta jsonb)` · `sync_state(connection_id, resource, cursor, last_synced_at, status)`
- **Satış (çekirdek):** `orders` · `order_line_items` · `order_transactions(gateway, amount, fee)` · `refunds` · `products` · `product_variants` · `customers`
- **Maliyet:** `cogs_rules(scope: sku|variant|product|global, country, min_qty, effective_from/to, cost_amount, handling_fee, source)` · `shipping_cost_rules(by weight|qty|destination)` · `payment_fee_rules` · `tax_config` · `custom_expenses(type: one_time|recurring, recurrence, start/end, allocation: store|spread)`
- **Reklam:** `ad_entities(provider, campaign/adset/ad hiyerarşisi)` · `ad_spend(provider, date, level, spend, impressions, clicks, conversions, conversion_value, currency)`
- **Rollup/türetilmiş:** `daily_store_metrics(store_id, date, revenue, discounts, refunds, cogs, shipping_cost, payment_fees, taxes, ad_spend, custom_expenses, net_profit, orders_count, ...)` · `product_profit_daily(store_id, product_id, date, units, revenue, cogs, attributed_ad_spend, net_profit)` · `fx_rates(date, base, quote, rate)`
- **Pano özelleştirme:** `dashboards(org_id|user_id, name, is_default)` · `dashboard_widgets(dashboard_id, type, config jsonb, layout x/y/w/h)` · `custom_metrics(org_id, name, formula, format)`
- **MCP:** `api_keys(org_id, hashed_key, scopes, last_used_at)`

**Güvenlik:** OAuth token'ları AES-256-GCM ile şifreli saklanır (anahtar env/KMS'ten). Webhook'larda HMAC doğrulaması zorunlu.

---

## 4. Caching & Kuyruk Stratejisi

- **BullMQ kuyrukları:** `shopify-sync`, `ads-sync`, `etsy-sync` (Faz 9), `webhooks`, `metrics-rollup`, `recurring-expenses`, `token-refresh`.
- **Repeatable jobs:** her bağlantı için periyodik artımlı sync (örn. 15 dk); nightly tam rollup; FX güncelleme.
- **Flow / chaining:** `sync tamamlandı → metrics-rollup tetikle` (BullMQ FlowProducer).
- **Idempotency:** tüm upsert'ler `external_id` unique + `onConflictDoUpdate`; webhook'larda event-id dedup (Redis SETNX).
- **Rate-limit (giden):** her provider için token-bucket (Redis); Shopify cost-based throttle, Etsy 10/sn, Meta/Google async insights.
- **Rate-limit (gelen):** `@nestjs/throttler` + Redis storage, plan bazlı kademeler.
- **Cache katmanı:** analytics sorguları Redis'te `org:store:range:filters` anahtarıyla TTL'li cache; rollup değişince ilgili anahtarlar invalidate edilir.
- **Backfill:** tarihsel veri Shopify **Bulk Operations API** ile; ilerleme `sync_state` üzerinden UI'a yansıtılır.

---

## 5. MCP Desteği (`packages/mcp`)

- Streamable HTTP transport (`@modelcontextprotocol/sdk`); Claude/ChatGPT bağlanabilir.
- Per-org **API key** (veya OAuth) ile yetki; analytics servis katmanını yeniden kullanır.
- **Tool seti (read-only):** `list_stores` · `get_profit_summary(store, range)` · `get_pnl(store, range, granularity)` · `top_products_by_profit(store, range, limit)` · `get_ad_performance(store, range, provider)` · `compare_periods(store, a, b)`.
- Client'ta MCP **API key yönetimi** ekranı.

---

## 6. Faz Özeti (Milestones)

| Faz | İçerik | API | Client |
|---|---|---|---|
| **0** | Monorepo & temel altyapı | Nest→apps/api, Drizzle, Redis, BullMQ, throttler, health, docker | Vite+React shell, Tailwind+shadcn, Query/Router |
| **1** | Auth & multi-tenancy | Org/User/Membership, JWT, RBAC, davet | Auth sayfaları, org switcher, korumalı route |
| **2** | Mağaza & entegrasyon iskeleti | stores, connections, Shopify OAuth+webhook, sync queues | Connect store akışı, integrations sayfası |
| **3** | Shopify veri alımı | orders/products/customers ingestion + backfill | Sync ilerleme UI, veri tazeliği |
| **4** | Maliyet modelleme | COGS/kargo/ücret/vergi/custom expense + recurring | COGS yönetimi, gider CRUD + recurrence |
| **5** | Kâr motoru & rollup | contribution servisi, daily/product rollup, FX, cache | (iç doğrulama) |
| **6** | Reklam & attribution | Meta/Google/TikTok insights, blended attribution, ROAS/POAS | Ad hesabı bağlama, reklam görünümleri |
| **7** | Analytics API & pano | analytics endpoints, custom metrics | Özelleştirilebilir grid pano, widget kütüphanesi |
| **8** | MCP server | packages/mcp tool seti + API key auth | MCP API key yönetimi |
| **9** | Sağlamlaştırma | **creem.io** billing (Basic/Pro, 14g trial), Etsy, observability, GDPR, CI/CD | Billing UI, plan gating |

Batch-seviyesi detaylar için track dosyalarına bakın.

---

## 7. Doğrulama (Verification)

- **Altyapı:** `docker-compose up` (pg+redis) → `pnpm --filter api start:dev` → `/health` & `/ready` 200; Swagger `/docs` açılır.
- **DB:** `drizzle-kit generate` + `migrate` temiz; örnek seed.
- **Auth:** register→login→refresh e2e; guard reddeder/kabul eder; RBAC test edilir.
- **Entegrasyon:** Shopify dev store ile OAuth + webhook HMAC; backfill kuyruk job'ı; `sync_state` ilerler.
- **Kâr motoru:** örnek sipariş + COGS + reklam ile `daily_store_metrics.net_profit` beklenen değere eşit (unit + e2e).
- **Analytics/Pano:** seed veriyle widget'lar doğru render; filtre cache hit/invalidation tutarlı.
- **MCP:** local server'a Claude Desktop/Inspector ile bağlan; `get_profit_summary` doğru sonuç.
- **CI:** `pnpm turbo run test lint build` yeşil.
