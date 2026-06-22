# API Yol Haritası (`apps/api` — NestJS + Drizzle + Postgres + BullMQ + Redis)

Bu doküman API tarafını faz → batch → görev olarak böler. Üst-seviye bağlam: [`../PLAN.md`](../PLAN.md).

**Modül dizini hedefi:** `apps/api/src/modules/{auth,organizations,stores,integrations,ingestion,costs,profit,analytics,dashboards,billing}` · `apps/api/src/{database,config,common,queue}`.

---

## Faz 0 — Monorepo & Temel Altyapı  ✅ TAMAMLANDI

> Doğrulandı (2026-06-21): `pnpm build` + `pnpm test` (3/3) + `pnpm typecheck` (4/4) yeşil; docker postgres+redis healthy; `/health` & `/ready` 200 (db+redis up); `/docs` Swagger; throttler/helmet/CORS aktif; `drizzle-kit generate` çalışıyor (0 tablo).
> Not: yerel makinede 5432/6379 başka projelerce kullanıldığından docker host portları **5433** (pg) ve **6380** (redis) olarak ayarlandı; `.env` buna göre.

### B0.1 — Workspace kurulumu
- [ ] `pnpm-workspace.yaml` + kök `package.json` + `turbo.json`.
- [ ] Mevcut Nest scaffold'u `apps/api`'ye taşı (kendi `.git`'ini kaldır; tek repo).
- [ ] `packages/config` (paylaşılan `tsconfig.base.json`, eslint flat config, prettier).
- [ ] `packages/shared` iskeleti (zod + tip export).

### B0.2 — Altyapı modülleri
- [ ] `database/`: drizzle-orm + `pg` Pool, `DatabaseModule` (global provider), `drizzle.config.ts`, `schema/index.ts`.
- [ ] `config/env.ts`: zod ile env şeması + `ConfigModule` validate.
- [ ] `common/redis`: ioredis bağlantı provider'ı.
- [ ] `queue/`: `@nestjs/bullmq` `BullModule.forRoot` (connection: redis), kuyruk register helper'ı.
- [ ] Global: `ValidationPipe`, `AllExceptionsFilter`, `nestjs-pino`, `helmet`, CORS, `@nestjs/throttler` + `@nest-lab/throttler-storage-redis`.
- [ ] `health/`: `@nestjs/terminus` `/health` (db+redis) & `/ready`.
- [ ] `@nestjs/swagger` `/docs`.
- [ ] `docker-compose.yml`: postgres + redis (+ opsiyonel bull-board).

**DoD:** `docker-compose up` → `pnpm --filter api start:dev` → `/health` 200, `/docs` açılır.

---

## Faz 1 — Auth & Multi-tenancy  ✅ TAMAMLANDI

> Doğrulandı (2026-06-21): 5 tablo migrate edildi; argon2 (@node-rs/argon2) parola hash; JWT access(15dk) + opaque refresh(30g, httpOnly cookie) rotation + **reuse-detection** (eski token → tüm aile iptal); global `JwtAuthGuard` (@Public ile health hariç) + `RolesGuard`; org switcher token'a aktif org yazıyor. Çok-kullanıcılı e2e curl akışı: me(401)→register→me→create-org→switch-org→refresh(rotate)→eski-cookie(401)→invite→accept→viewer-switch→viewer GET members(200)→viewer POST invite(**403 RBAC**)→owner members(2)→bad login(401)→zod invalid(400). Zod doğrulama `safeParse` ile (monorepo instanceof sorunu giderildi).

### B1.1 — Şema & migration
- [ ] `schema/auth.ts`: `users`, `organizations`, `memberships(role enum: owner|admin|analyst|viewer)`, `refresh_tokens`, `invitations`.
- [ ] `drizzle-kit generate` + `migrate`.

### B1.2 — Auth servisleri
- [ ] `auth/`: register/login (argon2), JWT access (kısa) + refresh (rotation + reuse-detection), logout.
- [ ] `JwtStrategy` + `JwtAuthGuard`; `RolesGuard` + `@Roles()`.
- [ ] `@CurrentUser()` & `@CurrentOrg()` decorator'ları; org context middleware/interceptor (header/path → membership doğrulama).

### B1.3 — Organizasyon & davet
- [ ] `organizations/`: create org, list my orgs, switch; member ekleme/çıkarma.
- [ ] Davet akışı (token + e-posta stub).

**DoD:** register→login→refresh e2e; korumalı endpoint guard'ı doğru çalışır; RBAC testleri yeşil.

---

## Faz 2 — Mağaza & Entegrasyon İskeleti  ✅ TAMAMLANDI (Shopify; Etsy/ads sonraki fazlar)

> Doğrulandı (2026-06-21): 3 tablo (stores, integration_connections, sync_state) migrate; **CryptoService** AES-256-GCM (token'lar şifreli saklanıyor — DB'de plaintext yok); **ConnectorRegistry** + Shopify connector (authorize URL, code→token exchange, webhook HMAC base64, callback HMAC hex, webhook kaydı); OAuth state Redis'te (TTL 600s); **BullMQ** shopify-sync/webhooks/token-refresh kuyrukları + WorkerHost processor'lar. e2e: overview→install(URL+Redis state)→webhook HMAC(200/401)→dev-connect→store+connection(active)→**sync_state queue→processor→done (3/3)**→token şifreli→disconnect(204)→auth(401)/RBAC(install owner/admin). 11 birim test (crypto round-trip/tamper/safeEqual + Shopify HMAC/URL). Gerçek OAuth handshake kayıtlı app + public URL gerektirir; dev-connect (non-prod) ile pipeline doğrulandı.

### B2.1 — Şema
- [ ] `schema/stores.ts`: `stores`, `integration_connections` (token alanları şifreli), `sync_state`.
- [ ] `common/crypto`: AES-256-GCM encrypt/decrypt servisi (anahtar env'den).

### B2.2 — Connector soyutlaması
- [ ] `integrations/connector.interface.ts`: `getAuthUrl`, `exchangeCode`, `refreshToken`, `registerWebhooks` sözleşmesi.
- [ ] Provider registry (DI ile sağlayıcı seçimi).

### B2.3 — Shopify OAuth + webhook
- [ ] `integrations/shopify/`: OAuth (install → callback → token), scope yönetimi, HMAC doğrulama.
- [ ] Zorunlu webhook'lar: `orders/create|updated`, `refunds/create`, `products/*`, `app/uninstalled`, GDPR (`customers/redact`, `shop/redact`, `customers/data_request`).
- [ ] `queue/`: `shopify-sync`, `webhooks`, `token-refresh` kuyrukları + repeatable job kaydı (15 dk artımlı).

**DoD:** Dev store ile OAuth tamamlanır, webhook HMAC doğrulanır, bağlantı `integration_connections`'a şifreli yazılır.

---

## Faz 3 — Shopify Veri Alımı  ✅ TAMAMLANDI

> Doğrulandı (2026-06-21): 7 satış tablosu (orders, order_line_items, order_transactions, refunds, products, product_variants, customers) migrate (0002); hepsi `(store_id, external_id)` unique + idempotent `onConflictDoUpdate`. **IngestionModule**: REST webhook + Bulk GraphQL ortak normalizer (GID↔numerik tek biçime indirger, `*Set.shopMoney` para çözümleme), satır toplamı hesabı; sipariş upsert tek transaction'da (satırlar tam-değiştir, hareket/iade tekil upsert). **ShopifyGraphqlClient** cost-aware throttle (`extensions.cost.throttleStatus` + `THROTTLED` backoff); **ShopifyBulkService** (bulkOperationRunQuery → poll → JSONL indir → `reconstructBulkObjects` ile `__parentId` iç içe yapı). **Backfill processor**: bağlantı token'ını çözer; `dev_` token'da sentetik REST veri (gerçek mağaza olmadan tüm hat), aksi halde Bulk; `sync_state` ilerleme (stats {processed,total}, status, lastSyncedAt). **Webhook processor**: Redis SETNX (`x-shopify-webhook-id`, 24s TTL) dedup + topic routing (orders/refunds/products/app-uninstalled). Okuma: `GET /stores/:id/sync` (org-kapsamlı) + `GET /stores/:id/orders` (cursor sayfalama, financialStatus/search filtre). e2e curl: dev-connect→backfill (orders 8 / products 5 / customers 4 `done`)→re-backfill idempotent (sayılar değişmedi)→webhook bad-HMAC(401)/teslimat(200)/tekrar-dedup/farklı-evt-upsert → tek sipariş; cursor round-trip 9 sipariş çakışmasız; cross-org store 404; unauth 401. 25 birim test (normalizer REST+bulk, JSONL reconstruct, sentetik determinism). Not: transactions/refunds backfill'i bulk'ta değil webhook ile yakalanır (gerçek mağaza ile genişletilecek); sentetik veri bunları kapsar.

### B3.1 — Şema
- [ ] `schema/sales.ts`: `orders`, `order_line_items`, `order_transactions`, `refunds`, `products`, `product_variants`, `customers` (hepsi `store_id` + `external_id` unique).

### B3.2 — Ingestion
- [ ] Shopify GraphQL Admin client (cost-aware throttle).
- [ ] **Backfill processor:** Bulk Operations API ile tarihsel sipariş/ürün/müşteri; durum `sync_state`.
- [ ] **Artımlı:** webhook payload → normalize → idempotent upsert (`onConflictDoUpdate`); cursor sync fallback.
- [ ] Webhook dedup (Redis SETNX, event-id).

**DoD:** Dev store siparişleri DB'ye normalize edilir; backfill ilerlemesi `sync_state`'te izlenir; tekrarlı webhook çift kayıt yapmaz.

---

## Faz 4 — Maliyet Modelleme  ✅ TAMAMLANDI

> Doğrulandı (2026-06-21): 6 tablo migrate (0003): `cogs_rules` (scope sku/variant/product/global + match_value, country, min_qty, effective_from/to, handling, source; **partial unique** `uq_cogs_default_rule` ile açık-uçlu varsayılan kural CSV-idempotent), `shipping_cost_rules` (ülke/qty/ağırlık aralıkları + base/per-item), `payment_fee_rules` (gateway yüzde+sabit), `tax_config` (mağaza başına tek; sales_tax_borne + income_tax_rate), `custom_expenses` (one_time|recurring + recurrence + allocation store|spread), `expense_allocations` (gün+mağaza materializasyon hedefi, `(expense,store,date)` unique). **CostResolverService**: COGS önceliği sku>variant>product>global (sonra ülke-özgül > yüksek min_qty > en güncel effective_from); kargo base+perItem*qty; ödeme ücreti %*tutar+sabit; vergi config. **CSV import** (saf RFC-4180 ayrıştırıcı, alias/CRLF/tırnak; dry-run önizleme + satır-bazlı hata raporu; uygulamada sku/ülke/qty doğal anahtarıyla idempotent upsert). **recurring-expenses** BullMQ kuyruğu + WorkerHost processor: create/update'te [startDate,bugün] materialize job'ı; günlük scheduler (`upsertJobScheduler`, cron 02:00) dün→bugün tüm aktif giderleri yeniden hesaplar; amortizasyon daily=tam, weekly=/7, monthly=/ayın-günü; tutar bugünden ileri yazılmaz (cap). RBAC: düzenleme owner/admin/analyst, okuma tüm üyeler; viewer salt-okunur. e2e curl (22/22): register→switch→dev-connect→COGS create global+sku→**resolve sku(39.0000)/global-fallback(10.0000)**→CSV dry-run(2 valid/1 invalid)→commit(2)→**re-import idempotent (count sabit 3)**→resolve CSV-sonrası(9.5000)→shipping(6.0000)→payment-fee(3.2000)→tax upsert/get→recurring expense→**async materialize 21 gün × 10.0000 (300/30)**→zod 400'ler→cross-org 404. 16 yeni birim test (cogs-csv 6, expense-materializer 10); toplam **43/43** yeşil; `pnpm build`+`typecheck` temiz. Not: BullMQ custom jobId `:` içeremiyor → `_` ayraç.

### B4.1 — Şema
- [ ] `schema/costs.ts`: `cogs_rules` (scope/country/min_qty/effective dates/handling), `shipping_cost_rules`, `payment_fee_rules`, `tax_config`, `custom_expenses` (one_time|recurring + recurrence + allocation).

### B4.2 — Servisler
- [ ] `costs/cost-resolver.service.ts`: bir sipariş satırı için geçerli COGS/kargo/ücret çözümleme (öncelik: SKU > variant > product > global; tarih + ülke + qty filtreleri).
- [ ] CSV import (COGS toplu) endpoint + doğrulama.
- [ ] `recurring-expenses` kuyruğu (BullMQ repeatable): yinelenen giderleri ilgili güne materialize et.

**DoD:** Örnek COGS/kargo kuralları çözümlenir; yinelenen gider job'ı doğru günlere yazar.

---

## Faz 5 — Kâr Motoru & Rollup  ✅ TAMAMLANDI

> Doğrulandı (2026-06-22): 3 tablo migrate (0004): `daily_store_metrics` (gün+mağaza net kâr özeti; revenue/discounts/refunds/cogs/shipping/payment_fees/taxes/ad_spend/custom_expenses/net_profit + orders_count/units; **unique** (store,date)), `product_profit_daily` (gün+mağaza+ürün; units/revenue/cogs/attributed_ad_spend/net_profit; unique (store,product,date)), `fx_rates` (gün base→quote, unique). **Saf formül** `profit/contribution.ts` (`orderNetContribution`/`dailyNetProfit`/`profitMargin`/`round4`) — Bölüm 2.4 birebir; birim testli. **ContributionService**: satış verisini okur, COGS/kargo/ödeme ücreti/vergi'yi `CostResolver` ile, çoklu para'yı `FxService` ile çözer (aynı para=1; yoksa `fx_rates`'ten ≤tarih kuru, eksikse 1+uyarı); ödeme ücreti gerçek `order_transactions.fee` öncelikli, yoksa kural. **MetricsService.rollupStore**: katkıları gün+mağaza ve ürün-gün bucket'larına toplar, dağıtılmış özel giderleri (`expense_allocations`) ekler, idempotent yeniden yazar (aralığı/mağazayı sil→ekle); Redis cache `metrics:{store}:{from}:{to}` (TTL 300s) + rollup'ta `scan`-`del` invalidation. **metrics-rollup** kuyruğu: sync sonrası **FlowProducer zinciri** (3 sync child → parent rollup), **gece scheduler** (03:00 tam — recurring-expenses 02:00 sonrası), **webhook artımlı** (order/refund → etkilenen gün rollup); **fx-rates** repeatable (01:00; `FX_API_URL` varsa çeker, yoksa no-op). Okuma: `GET /stores/:id/metrics` (günlük seri + toplamlar + marj), `GET .../products` (ürün sıralaması net kâra göre), `POST .../recompute` (RBAC owner/admin/analyst, 202). **e2e** (dev-connect→sentetik backfill→auto rollup→global COGS(5)→recompute→GET metrics): sentetikten bağımsız hesaplanan beklenenle birebir → revenue **419.85** · discounts 10 · refunds 92.44 · cogs 75 · paymentFees 16.63 · units 15 · **net_profit 225.78** · margin %53.78; cache hit; ürün sıralaması 5 ürün. Birim: `contribution.spec` (7) → toplam **50/50**; `turbo run typecheck test build` **7/7** yeşil. Not: kargo geliri (müşteriden alınan) şimdilik ciroya katılmaz (Bölüm 2.4'e sadık); reklam Faz 6'da dolar.

### B5.1 — Şema
- [x] `schema/metrics.ts`: `daily_store_metrics`, `product_profit_daily`, `fx_rates`.

### B5.2 — Motor
- [x] `profit/contribution.service.ts`: sipariş-bazında net katkı (Bölüm 2.4 formülü); FX dönüşümü (`fx_rates`).
- [x] `metrics-rollup` kuyruğu: sync sonrası (FlowProducer chain) + nightly tam rollup; artımlı recompute (değişen gün/mağaza).
- [x] Redis aggregate cache + invalidation (rollup yazınca ilgili anahtarları sil).
- [x] FX güncelleme repeatable job.

**DoD:** Birim testte formül doğru; e2e'de örnek veriyle `daily_store_metrics.net_profit` beklenen değere eşit.

---

## Faz 6 — Reklam Entegrasyonları & Attribution  ✅ TAMAMLANDI

> Doğrulandı (2026-06-22): 2 tablo migrate (0005): `ad_entities` (hiyerarşi account/campaign/adset/ad; unique (store,provider,external)), `ad_spend` (gün+varlık harcama/metrik; unique (store,provider,entity,date)) + `ad_level` enum. **AdConnector** soyutlaması + `AdConnectorRegistry`; **Meta** connector gerçek OAuth + Marketing API insights (`act_/insights` level=campaign time_increment=1; purchase action'ları → conversions/conversionValue), **Google** (OAuth2 offline + adwords scope) ve **TikTok** (Business API OAuth) connector'ları — Google/TikTok **canlı** insight çekimi Faz 9'a bırakıldı; üçü de **dev-connect sentetik** ile tam çalışır. `buildAuthUrl` + sentetik determinism birim testli (7 yeni test). **ads-sync** kuyruğu + processor: dev (`dev_` token) → sentetik (2 kampanya×2 adset×2 ad, 14 gün; ad→adset→campaign çift-sayımsız toplanır), canlı → `connector.fetchInsights`; idempotent upsert (`ad_entities`+`ad_spend` onConflictDoUpdate); günlük scheduler (04:00) tüm aktif reklam bağlantılarını artımlı; senkron sonrası mağaza **tam rollup** tetikler. **Attribution:** campaign-seviyesi gün toplamı → `daily_store_metrics.ad_spend` (blended); `net_profit` reklamı düşer; ürün-seviyesi **ciro-payı** atfı (`product_profit_daily.attributed_ad_spend`, ürün net'inden düşülür). ROAS/POAS okuma katmanında: blended ROAS (ciro/harcama) + POAS (net kâr/harcama) `MetricsTotals`'a; platform ROAS (conversionValue/spend) `ads/performance`'ta. Endpoint'ler: `GET /stores/:id/ads/performance` (kırılım + blended ROAS/POAS + gün serisi), reklam OAuth `GET/POST /integrations/ads/:provider/{install,callback,dev-connect}`; overview ad sağlayıcıları connectable işaretler. **e2e** (dev-connect-ads meta → sentetik ads-sync 14 varlık/196 satır → rollup): sentetikten bağımsız hesapla → **ad_spend 1120**, net_profit 225.78 → **-894.22**, blended ROAS **0.3749**, POAS **-0.7984**; ads/performance 2 kampanya, conversionValue 3920, platform ROAS **3.5**; ürün attributed_ad_spend 628 (sipariş günlerindeki harcama). `turbo run typecheck test build` **7/7** + **57/57** birim yeşil. Not: Google/TikTok canlı insight Faz 9; blended atıf sipariş olmayan günlerde ürüne atfetmez (mağaza seviyesinde kalır).

### B6.1 — Şema
- [x] `schema/ads.ts`: `ad_entities` (campaign/adset/ad), `ad_spend` (provider/date/level/metrics).

### B6.2 — Connector'lar
- [x] `integrations/meta/`: OAuth + Marketing API insights (async report, günlük breakdown).
- [x] `integrations/google/`: OAuth + GAQL günlük metrikler (developer token). _(OAuth tam; canlı GAQL çekimi Faz 9)_
- [x] `integrations/tiktok/`: OAuth + Business API reports. _(OAuth tam; canlı rapor çekimi Faz 9)_
- [x] `ads-sync` kuyruğu + repeatable; idempotent upsert.

### B6.3 — Attribution
- [x] Gün+mağaza **blended** dağıtım; opsiyonel UTM → ürün atfı; ROAS/POAS hesabı rollup'a katılır. _(ürün atfı ciro-payı; UTM Faz 7+)_

**DoD:** En az bir reklam hesabı bağlanır, günlük spend çekilir, `daily_store_metrics.ad_spend` dolar; ROAS/POAS üretilir.

---

## Faz 7 — Analytics API & Custom Metrics  ✅ TAMAMLANDI

> Doğrulandı (2026-06-22): 1 migration (0006): `dashboards`, `dashboard_widgets` (config jsonb + x/y/w/h grid), `custom_metrics` (+ `widget_type`/`custom_metric_format` enum); org başına **tek varsayılan pano** `partial unique` (`uq_dashboard_default … where is_default`). **AnalyticsModule** (org-kapsamlı, çok-mağaza filtreli, Redis cache `analytics:{org}:*` TTL 300 — rollup'ta org anahtarları da invalidate): `GET /analytics/{profit-summary,pnl,timeseries,store-comparison,products,ads/performance,customers/ltv,customers/cac,customers/cohorts}`. Ortak **`analyticsFilterSchema`** (from/to + `storeIds` virgüllü + `compare`); `resolveOrgStores` istenen mağazaları org'a göre doğrular (yoksa 404), raporlama para birimi ilk mağaza (çok-para FX dönüşümü yok). **profit-summary** `compare=true` → önceki eşit-uzunluk dönem toplamları + yüzde delta; **pnl** ciro→net kâr satırları + ciroya oran; **timeseries** gün-toplamı seri; **products** net kâra göre sıralama (`limit`); **ads/performance** `AdsQueryService.getOrgPerformance` ile blended ROAS/POAS (storeId="*"). **Müşteri analitiği** (`CustomersService`, müşteri kimliği `storeId:cust`): LTV (müşteri başına ort. ciro + AOV + yeni/dönen + tekrar oranı + top10), CAC (reklam/yeni müşteri), kohort (edinme-ayı tutundurma matrisi). **Güvenli formül değerlendirici** (`custom-metric.ts` — tokenizer + recursive-descent; **`eval` YOK**; whitelist alanlar + `+ − * /` + parantez; sıfıra bölme/bilinmeyen alan → null) + `custom_metrics` CRUD + `GET /custom-metrics/values`. **Dashboards CRUD** + `PUT /:id/widgets` (layout tam-değiştir persist); varsayılan geçişi transaction'da (partial-unique ihlali yok); RBAC düzenleme owner/admin/analyst, okuma tüm üyeler. **e2e** (dev-connect shopify+meta synthetic → rollup → analytics): revenue **419.85** · adSpend **1120** · net **−819.22** · blended ROAS **0.3749** · platform ROAS **3.5** (conversionValue 3920); ltv **4 müşteri** / AOV 61.35 / LTV 122.69, cac **280**, 1 kohort (2025-05, size 4); custom metric AOV=`revenue/ordersCount`=**52.48**; geçersiz formül→**400**; dashboard CRUD + 2 widget persist; 2. pano `isDefault` geçişi temiz; cache hit hızlı. **`custom-metric.spec`** (10) → toplam **67/67** birim; `turbo run typecheck test build` **7/7** yeşil. Not: analytics agregaları cursor sayfalama gerektirmedi (sınırlı küme; `products` `limit` ile); `channel` filtresi `ads/performance` provider kırılımına bırakıldı.

### B7.1 — Endpoints (`analytics/`)
- [x] `GET profit-summary`, `GET pnl`, `GET timeseries`, `GET products/ranking` (net kâra göre), `GET ads/performance`, `GET customers/{ltv,cac,cohorts}`. _(+ `store-comparison`)_
- [x] Ortak filtre DTO'su (date range, store[]); Redis cache (org-kapsamlı, rollup'ta invalidate). _(cursor sayfalama agregalarda gereksiz; `products` `limit` ile)_

### B7.2 — Custom metrics & dashboards
- [x] `schema/dashboards.ts`: `dashboards`, `dashboard_widgets`, `custom_metrics`.
- [x] Custom metric formül değerlendirici (güvenli; whitelisted alanlar/operatörler; `eval` yok).
- [x] Dashboard CRUD + widget layout persist (org başına tek varsayılan).

**DoD:** Seed veriyle tüm analytics endpoint'leri doğru sonuç + cache hit/invalidation tutarlı; custom metric formülü değerlendirilir.

---

## Faz 8 — MCP Server (`packages/mcp`)  ✅ TAMAMLANDI

> Doğrulandı (2026-06-22): **`packages/mcp`** — çerçeveden bağımsız paket (CJS; SDK'nın CJS build'i ile **tek kopya**, ESM/CJS interop sorunsuz): tool kataloğu (6 tool, zod giriş şemaları + kapsam) + **`McpDataProvider`** sözleşmesi + `buildMcpServer`/`handleMcpRequest` (`@modelcontextprotocol/sdk@1.29.0` **Streamable HTTP**, **stateless** `sessionIdGenerator:undefined` + `enableJsonResponse`). migration 0007: **`api_keys`** (org-kapsamlı; `key_hash` sha256 **unique** + `key_prefix` (chk_…) + `scopes text[]` + `last_used_at`/`revoked_at`; ham anahtar asla saklanmaz, yalnız oluşturmada bir kez döner). **`ApiKeysModule`**: CRUD (owner/admin) + `verify()` (sha256 lookup, iptal kontrolü, 60s throttle'lı `last_used` yazımı). **`McpModule`**: `POST/GET/DELETE /api/mcp` (`@Public`, `Authorization: Bearer chk_…` → org + scopes), anahtarın kapsamlarına göre izinli tool'lar kaydedilir; somut provider **analytics servislerini** çağırır (profit-summary/pnl/products/ads = REST ile **aynı kod yolu**), `list_stores` `resolveOrgStores`, `compare_periods` iki dönem profitSummary + yüzde delta. **e2e** (node fetch): register→dev-connect shopify (419.85/8) + meta_ads (spend 1120)→rollup→API key (4 scope)→initialize + tools/list (6) + tools/call → **`get_profit_summary` MCP == REST (deep-equal): revenue 419.85 · adSpend 1120 · net −819.22 · margin −195.12 · blended ROAS 0.3749 · POAS −0.7314; `get_ad_performance` platform ROAS 3.5 (convValue 3920)**; scope-gating (`profit:read` anahtarı yalnız 3 profit tool'u; ads/stores gizli; yasak tool çağrısı → isError); bad/revoked key → **401**; `last_used_at` güncellendi. Birim: `api-key.crypto.spec` (5) → **72/72**; `turbo run typecheck test build` **9/9** yeşil. Bağlanma dokümanı: [`packages/mcp/README.md`](../../packages/mcp/README.md) (Inspector + Claude Desktop + mcp-remote + curl). Not: in-process reuse için SDK tek CJS kopya (Node 22 `require(ESM)` ile `@churnify/shared` tüketilir); Google/TikTok canlı insight Faz 9.

- [x] `@modelcontextprotocol/sdk` Streamable HTTP server.
- [x] Per-org API key auth (`api_keys` tablosu, hash doğrulama, scopes).
- [x] Tool seti: `list_stores`, `get_profit_summary`, `get_pnl`, `top_products_by_profit`, `get_ad_performance`, `compare_periods` — analytics servislerini yeniden kullanır.
- [x] Bağlanma dokümanı (Claude Desktop / Inspector).

**DoD:** MCP Inspector ile bağlanılır; `get_profit_summary` REST ile aynı sonucu döndürür.

---

## Faz 9 — Sağlamlaştırma / Billing / Etsy / Prod

> **Billing sağlayıcısı: [creem.io](https://creem.io) (Merchant of Record), Stripe değil.** İki plan: **Basic** ve **Pro**; **her plan 14 günlük ücretsiz deneme** içerir. Creem REST: `POST /v1/checkouts` (hosted checkout), `POST /v1/customers/billing` (customer portal); webhook'lar `creem-signature` başlığıyla **HMAC-SHA256** (gizli: `CREEM_WEBHOOK_SECRET`) doğrulanır. Plan→ürün eşlemesi env'den (`CREEM_PRODUCT_BASIC`/`CREEM_PRODUCT_PRO`); test ucu `https://test-api.creem.io`. Plan limitleri `packages/shared/billing.ts`'te (free=1, basic=3, pro=25 mağaza).

> Doğrulandı (2026-06-22, **billing**): migration 0008 (`subscriptions` org-tekil + `billing_events` `creem_event_id` unique dedup) uygulandı; `BillingModule` (Creem anahtarı yokken **dev sentetik** mod). **e2e curl** (canlı API): register (owner+org otomatik) → `GET /billing` (abonelik yok → **free**, limit 1) → `dev-activate basic` (**trialing**, 14g deneme = 2026-07-06, limit 3) → dev'de `checkout` **400** (dev-activate yönlendirir) → geçersiz plan **400** → webhook `subscription.expired` (dev'de imza atlanır) **200** → durum **expired/active=false**, free entitlement'a düşer → **aynı event id replay → dedup**, durum değişmez → **plan gating**: free limit 1 → store#1 **201**, store#2 **403** ("Mağaza limitine ulaşıldı (1/1)…"), var olan mağaza **reconnect muaf 201** → `dev-activate pro` (limit 25) sonrası store#2 **201**, kullanım 2/25. Birim: `creem.service.spec` (8 — HMAC doğru/yanlış/eksik/Buffer/dev-skip + plan↔ürün çift yön). `turbo run typecheck test build` **9/9** yeşil. Not: canlı Creem checkout/portal kayıtlı ürün + webhook secret gerektirir; dev-connect deseniyle (dev-activate + imzasız webhook) uçtan uca doğrulandı.

> Doğrulandı (2026-06-22, **Etsy + GDPR + observability + CI/Docker**): migration yok (mevcut satış/stores tablolarını kullanır). **Canlı e2e curl** (API boot, observability dahil): **Etsy** dev-connect (`benim-etsy-dukkanim`) → `etsy connectable:true` → sync_state products/orders/customers **done** → metrics **revenue 518.85 · netProfit 375.49 · orders 8 · units 15** (normalize→upsert→rollup tam hat). **GDPR** (Shopify dev-connect, HMAC `dev_shopify_secret`): `customers/data_request`→**200** (ack), `customers/redact`→**200**, `shop/redact`→**200** → siparişler **8→0** (cascade), mağaza **disconnected**. **Bull-Board** `/admin/queues`→**200** (dev). Birim: `etsy-normalizer.spec` (8 — Money/ts/listing/receipt/buyer/determinizm). API jest **88/88** (14 suite), `turbo run typecheck test build` **9/9** yeşil. Not: Etsy/Meta-Google-TikTok canlı OAuth kayıtlı app gerektirir → dev-connect (sentetik) ile uçtan uca; OTel/Sentry yapılandırılmamışsa no-op.

- [x] **creem.io** billing + webhook + plan gating (store limiti). `schema/billing.ts` (`subscriptions` + `billing_events` dedup), `BillingModule`: `CreemService` (checkout/portal/getSubscription/HMAC doğrulama, anahtar yoksa **dev sentetik** mod), `BillingService` (org abonelik durumu + entitlement + `assertCanAddStore`), `BillingController` (`GET /billing`, `POST /billing/checkout`, `POST /billing/portal`, `POST /billing/dev-activate` (non-prod), `@Public POST /billing/webhook` raw-body HMAC). `integrations` mağaza oluşturmadan önce plan limitini doğrular (reconnect muaf).
- [x] **Etsy** connector (OAuth2 PKCE, Open API v3, listings/receipts/buyers) + `etsy-sync` kuyruğu. `integrations/etsy/etsy.connector.ts` (PKCE S256, token exchange, `fetchShop`/`fetchResource`), `ingestion/etsy/` (saf normalizer: Money `amount/divisor`, unix-ts; + sentetik API-şekilli veri), `EtsyBackfillService` (dev token→sentetik, aksi→Open API v3) → `IngestionService` ile **aynı** idempotent upsert; `EtsySyncProcessor` + `enqueueEtsyBackfill` (FlowProducer→rollup zinciri, Shopify ile aynı). `etsy/{install,callback,dev-connect}` endpoint'leri.
- [x] Observability (hepsi **env-gated**): **OpenTelemetry** trace (`OTEL_EXPORTER_OTLP_ENDPOINT` → NodeSDK auto-instrumentation, main.ts'te ilk import), **Sentry** (`SENTRY_DSN` → init + `AllExceptionsFilter` 5xx `captureException`), **Bull-Board** (`/admin/queues`, 8 kuyruk; üretimde `BULL_BOARD_ENABLED=true` + opsiyonel basic-auth).
- [x] **GDPR** veri silme (Shopify redact webhook'ları): `GdprService` — `customers/redact` (müşteri sil + siparişlerde PII anonimleştir), `shop/redact` (ham satış/müşteri verisini sil, cascade), `customers/data_request` (kayıt). Webhook handler topic routing + connector webhook kayıt listesine eklendi.
- [x] CI + prod Docker: `.github/workflows/ci.yml` (typecheck·test·build + migrations job postgres ile + Playwright e2e job), `apps/api/Dockerfile` (multi-stage, pnpm deploy, `dist/database/migrate.js` programatik migrator), `apps/web/Dockerfile` (+ nginx SPA), `docker-compose.prod.yml` (api+web+pg+redis+migrate one-shot), `.dockerignore`.
