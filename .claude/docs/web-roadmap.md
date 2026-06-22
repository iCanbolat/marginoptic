# Client Yol Haritası (`apps/web` — React + Vite + TS SPA)

Bu doküman client tarafını faz → batch → görev olarak böler. Üst-seviye bağlam: [`../PLAN.md`](../PLAN.md). API sözleşmesi `packages/shared` (zod) üzerinden tip-güvenli.

**Dizin hedefi:** `apps/web/src/{routes,features,components,lib/api,lib/auth,store,hooks}` · feature-based klasörler (`features/{auth,stores,integrations,costs,dashboard,ads,analytics,settings}`).

---

## Faz 0 — Uygulama İskeleti  ✅ TAMAMLANDI

> Doğrulandı (2026-06-21): Vite+React+TS shell, Tailwind v4 (@tailwindcss/vite), TanStack Router (code-based) + TanStack Query kuruldu; `vite build` üretim bundle'ı üretiyor; dashboard `/health` query'si ile API'ye bağlanıyor; `@churnify/shared` tipleri tüketiliyor. (shadcn/ui ilk bileşen gerektiğinde B1'de init edilecek.)

### B0.1 — Kurulum
- [ ] Vite + React + TS (`apps/web`), `packages/config` tsconfig/eslint extend.
- [ ] Tailwind + shadcn/ui kur; tema (light/dark) + tasarım token'ları.
- [ ] **TanStack Router** (type-safe file/route tree) + **TanStack Query** (QueryClient, devtools) — _kilitli karar_.
- [ ] `lib/api`: fetch wrapper (auth header, error normalize); tipler `packages/shared`'dan (orval/ts-rest opsiyonel codegen).
- [ ] `.env` + runtime config (`VITE_API_URL`).

### B0.2 — Shell
- [ ] App layout (sidebar + topbar + content), responsive; boş/loading/error state primitive'leri.

**DoD:** `pnpm --filter web dev` → shell render, API health çağrısı çalışır.

---

## Faz 1 — Auth & Org  ✅ TAMAMLANDI (forgot/reset hariç)

> Doğrulandı (2026-06-21): **shadcn/ui kuruldu** — Vite + Tailwind v4, `apply --preset b6GMxre3X` (Mira stili, zinc base, Geist+DM Sans, hugeicons). Zustand auth store (memory access token), `apiFetch` 401'de tek-uçuş refresh + retry; açılışta refresh ile oturum geri yükleme; TanStack Router korumalı `app` layout + `/login` `/register`; org switcher (switch-org → query invalidation); üyeler sayfası (davet + rol değiştir + kaldır, RBAC'a göre UI gating, sonner toast). `pnpm build` + typecheck yeşil; dev server :5173 serve ediyor. (forgot/reset-password Faz 9'a bırakıldı.)

- [ ] `features/auth`: login / register / forgot-password / reset sayfaları (react-hook-form + zod).
- [ ] `lib/auth`: token store (memory access + httpOnly/refresh akışı), 401'de refresh interceptor + retry.
- [ ] Korumalı route guard'ı; auth olmayan → login redirect.
- [ ] **Org switcher** (topbar); aktif org context'i query key'lere yansır.
- [ ] `features/settings`: members listesi, davet gönderme, rol değiştirme (RBAC'a göre UI gating).

**DoD:** Giriş→pano→refresh sorunsuz; org değişince veriler yeniden yüklenir; yetkisiz aksiyonlar UI'da gizli.

---

## Faz 2 — Mağaza Bağlama & Entegrasyonlar  ✅ TAMAMLANDI

> Doğrulandı (2026-06-21): `/integrations` sayfası — provider kartları (Shopify bağlanabilir, Meta/Google/TikTok "Yakında"), Shopify bağla formu (shop alan adı → install → Shopify'a redirect) + **Dev bağla** (yalnız `import.meta.env.DEV`), bağlantılar tablosu + kaldır (RBAC: owner/admin). Topbar'da **StoreSelector** (zustand persist, "Tüm mağazalar" + mağaza listesi); nav'a "Entegrasyonlar" eklendi. `?connected=shopify` dönüşünde toast + query invalidation. typecheck + `pnpm build` yeşil; dev server HMR ile çalışıyor.

- [ ] `features/integrations`: provider kartları (Shopify/Meta/Google/TikTok), bağlantı durumu (connected/error/syncing).
- [ ] **Connect store** akışı: Shopify OAuth redirect başlat → callback sonrası dönüş + toast.
- [ ] **Store selector** (global): aktif mağaza / "tüm mağazalar" seçimi, query'lere yansır.
- [ ] Bağlantı yönetimi: disconnect, yeniden bağla, scope uyarıları.

**DoD:** Shopify mağazası UI'dan bağlanır, listede "connected" görünür, store selector çalışır.

---

## Faz 3 — Sync Durumu & Veri Görünürlüğü  ✅ TAMAMLANDI

> Doğrulandı (2026-06-21): `SyncStatusCard` (`features/sync`) — `GET /stores/:id/sync` polling (`refetchInterval` complete olana kadar 2s, sonra durur), kaynak başına ilerleme çubuğu + durum rozeti + processed/total + lastError. Topbar `DataFreshnessBadge` — aktif (yoksa ilk) mağazanın tazeliği: "Eşitleniyor…" (spin) / "X dk önce güncellendi" (`formatRelativeTime`). `OrdersPage` (`/orders`, nav "Siparişler") — sync kartı + ham sipariş tablosu: arama (350ms debounce) + financialStatus filtresi + cursor sayfalama (cursor geçmiş stack, `keepPreviousData`), para `Intl.NumberFormat` ile biçimli, test rozeti. `tsc --noEmit` + `vite build` + `turbo run typecheck test build` (7/7) yeşil. (Faz 0'dan beri eslint binary'si workspace'te kurulu değil — lint çalıştırılamıyor.)

- [ ] Backfill ilerleme bileşeni (`sync_state` polling/SSE): yüzde + son sync zamanı.
- [ ] Veri tazeliği rozeti (topbar): "X dk önce güncellendi".
- [ ] Ham sipariş tablosu (debug/iç): filtre + pagination (TanStack Table).

**DoD:** Bağlama sonrası backfill ilerlemesi canlı görünür; sipariş tablosu veriyi listeler.

---

## Faz 4 — Maliyet Yönetimi UI  ✅ TAMAMLANDI

> Doğrulandı (2026-06-21): `/costs` sayfası (nav "Maliyetler") — aktif mağaza (store selector) kapsamlı **Tabs** (COGS · Kargo · Ödeme & Vergi · Giderler); yeni shadcn primitifleri eklendi (tabs/switch/textarea, `radix-ui` unified). **COGS tab:** kural tablosu + ekleme formu (kapsam sku/variant/product/global, eşleşme, birim maliyet, işleme, min adet, ülke) + sil; **CSV import** (textarea → "Önizle" dry-run → satır-bazlı geçerli/hata tablosu + özet → "İçe aktar" commit, toast). **Kargo tab:** ülke/adet/ağırlık aralıkları + sabit/adet-başı maliyet CRUD. **Ödeme & Vergi tab:** gateway yüzde+sabit ücret kuralları CRUD + vergi config formu (satıcı-üstlenir switch + gelir vergisi oranı, PUT upsert). **Giderler tab:** org-kapsamlı özel gider CRUD + **recurrence editörü** (tek seferlik / günlük-haftalık-aylık, dağıtım store/spread, başlangıç-bitiş tarihleri); aktiflik switch (PATCH), "Yeniden hesapla" (materialize tetikle), sil. RBAC: düzenleme owner/admin/analyst, viewer salt-okunur (formlar/aksiyonlar gizli). Tüm mutasyonlar TanStack Query invalidation + sonner toast; `ApiError.issues` alanları kullanıcıya yansıtılır. `tsc --noEmit` + `vite build` + dev transform (modüller 200, hata yok) + `turbo run typecheck test build` (7/7) yeşil. (eslint hâlâ kurulu değil.)

- [ ] `features/costs/cogs`: ürün/variant/SKU bazlı COGS düzenleme tablosu; **toplu düzenleme** + **CSV import** (önizleme + hata raporu).
- [ ] Kargo kuralları editörü (ağırlık/qty/varış).
- [ ] Ödeme ücreti & vergi config formları.
- [ ] `features/costs/expenses`: **özel gider CRUD** + **recurrence editörü** (one-time / daily / weekly / monthly; start/end; allocation: store/spread).

**DoD:** COGS CSV import çalışır; yinelenen gider oluşturulup düzenlenebilir; değişiklikler API'ye yazılır.

---

## Faz 5 — (Pano hazırlığı)  ✅ TAMAMLANDI

> Doğrulandı (2026-06-22): **`packages/shared/format.ts`** — `formatCurrency`/`formatNumber`/`formatPercent`/`formatDate`/`formatDateRange`/`formatRelativeTime`/`percentChange`/`toNumber` (number|string kabul, çoklu para birimi, varsayılan yerel `tr-TR`, kısa/compact + işaretli yüzde seçenekleri); ana-birim ondalık string'lerle çalışır (minor-unit `money.ts` ayrı). **`packages/shared/metrics.ts`** — Faz 5 API DTO sözleşmesi (`StoreMetricsSummary`/`DailyStoreMetric`/`MetricsTotals`/`ProductProfitRow`/`metricsQuerySchema`). **web `lib/format.ts`** shared'i yeniden ihraç + null-güvenli `money`/`count`. **`components/charts/`** — tema uyumlu (`--chart-1..5` CSS değişkenleri, light/dark otomatik) **LineChart/AreaChart/BarChart** wrapper'ları: `ResponsiveContainer` + temalı `CartesianGrid`/`XAxis`/`YAxis`/`Legend` + özel `ChartTooltip` (popover stili); `kind` (currency/number/percent) eksen-kısa & tooltip-tam biçimlendirici, çok-serili + `stacked`, `xFormatter` (tarih ekseni). `recharts@2.15.4` eklendi (React 19). **`features/preview/charts-preview.tsx`** (iç rota `/preview/charts`, nav'da yok): biçimlendirici örnekleri + 4 grafik (net kâr çizgi · ciro/reklam alan · maliyet kırılımı sütun · sipariş adet) örnek veriyle. `tsc --noEmit` + `vite build` + `turbo run typecheck test build` (7/7) yeşil. (Gerçek `daily_store_metrics` beslemesi Faz 7 panosunda.)

- [x] Para/yüzde/tarih formatlama util'leri (`packages/shared` ile uyumlu, çoklu para birimi).
- [x] Grafik primitive wrapper'ları (Recharts: line/bar/area, tooltip, legend) — tema uyumlu.

**DoD:** Reusable grafik + format bileşenleri Storybook/örnek sayfada doğrulanır.

---

## Faz 6 — Reklam Görünümleri  ✅ TAMAMLANDI

> Doğrulandı (2026-06-22): `adsApi.performance` + `integrationsApi.adInstall`/`adDevConnect` (shared `ads.ts` DTO'ları). **`features/ads/ads-page.tsx`** (`/ads`, nav "Reklamlar") — aktif (yoksa ilk) mağaza kapsamlı; tarih aralığı (başlangıç/bitiş) + **kırılım seçici** (kampanya/adset/ad); özet KPI kartları (**reklam harcaması · dönüşüm değeri · blended ROAS · POAS**); günlük **AreaChart** (harcama vs. dönüşüm değeri — Faz 5 grafik primitive'leri); kırılım tablosu (harcama/gösterim/tıklama/dönüşüm/gelir/ROAS); `?connected=` dönüşünde toast + invalidation. **Entegrasyonlar sayfası:** reklam sağlayıcıları artık `connectable`; **"Reklam hesabı bağla" kartı** (sağlayıcı + harcamanın atfedileceği mağaza + hesap kimliği; **Bağla**=OAuth yönlendirme, **Dev bağla**=sentetik, yalnız `import.meta.env.DEV`). `tsc --noEmit` + `vite build` + `turbo run typecheck test build` (7/7) yeşil. (Gerçek OAuth kayıtlı app + public URL gerektirir; dev-connect ile uçtan uca doğrulandı.)

- [x] `features/ads`: Meta/Google/TikTok hesabı bağlama akışları (integrations ile ortak pattern).
- [x] Reklam performans tablosu/grafikleri: spend, ROAS, **POAS (net profit on ad spend)**, kampanya/adset/ad kırılımı.

**DoD:** Bağlı reklam hesabının günlük spend & ROAS/POAS değerleri görüntülenir.

---

## Faz 7 — Özelleştirilebilir Pano (çekirdek değer)  ✅ TAMAMLANDI

> Doğrulandı (2026-06-22): **`features/dashboard`** — `react-grid-layout` ile sürükle-bırak + yeniden boyutlandırma (düzenle/kaydet modu; layout `PUT /dashboards/:id/widgets` ile persist; tema-uyumlu yerel `grid.css` — pnpm transitif CSS importu çözülemediğinden paket CSS'i yerine; CSS-çizimli resize tutamacı). **Widget kütüphanesi (7):** KPI kartı (metrik seçimi + önceki-dönem yüzde delta, maliyet metriklerinde renk tersine), zaman serisi (çok seri; line/area/bar), P&L tablosu (ciroya oran %), ürün kârlılık sıralaması (net kâra göre), **maliyet kırılımı** (yeni `DonutChart` charts'a eklendi), kanal karşılaştırma (reklam sağlayıcı bazlı sütun), özel metrik kartı. **Widget config paneli** (başlık · metrik/seri seçimi · görsel tip · satır sayısı · özel-metrik seçimi · **per-widget tarih override**) — yeni `Dialog` primitifi. **Kontroller:** global **tarih aralığı** (preset Son 7/30/90 gün · Bu ay/yıl + custom + **30 günlük karşılaştırma toggle**; yeni `Popover` primitifi), **çok-mağaza filtresi** (Popover checkbox; "Tüm mağazalar" = boş = org geneli) — ikisi de tüm widget'lara yansır; React Query (`staleTime` 60s) aynı filtreli widget'lar arası cache paylaşır. **Custom metric builder** (`CustomMetricsDialog`: ad + formül + format; whitelist alan chip'leri; sunucu doğrulama hatasını `ApiError.issues` ile formül alanına yansıtır; liste + sil). **Pano CRUD** (`DashboardSwitcher`: çoklu pano seç, oluştur/yeniden adlandır/sil/**varsayılan yap**; ilk kurulumda **örnek pano seed** — 4 KPI + trend + maliyet + P&L + ürünler). RBAC: viewer salt-okunur (düzenle/widget-ekle/builder gizli; owner/admin/analyst düzenler). `analyticsApi`/`dashboardsApi`/`customMetricsApi` `lib/api`'ye eklendi; pano artık **ana sayfa** (`/`, eski placeholder kaldırıldı). `tsc --noEmit` + `vite build` + dev transform (dashboard modülleri 200, hata yok) + `turbo run typecheck test build` (**7/7**) yeşil. (Tarih varsayılanı Son 30 gün; dev synthetic verisi geçmişte olduğundan veriyi görmek için preset/aralık seçilir.)

### B7.1 — Grid & widget motoru
- [x] `react-grid-layout`: sürükle-bırak + yeniden boyutlandırma; layout `dashboard_widgets`'a persist.
- [x] Widget kütüphanesi: **KPI kartı**, **time-series grafik**, **P&L tablosu**, **ürün kârlılık sıralaması** (net kâra göre), **maliyet kırılımı (donut)**, **kanal karşılaştırma** (+ **özel metrik** kartı).
- [x] Widget config paneli (metrik seçimi, tarih aralığı override, görsel tip).

### B7.2 — Kontroller
- [x] Global **date range picker** (preset + custom) + 30 günlük karşılaştırma toggle.
- [x] **Çok-mağaza** filtresi (tüm widget'lara yansır) + **store-comparison** görünümü (kanal/mağaza widget'ları).
- [x] **Custom metric builder** (formül + format) UI.
- [x] Pano CRUD: birden fazla pano, varsayılan pano (org içi paylaşılan).

**DoD:** Kullanıcı widget ekleyip taşıyabilir, layout kalıcı; KPI/grafik/tablo doğru sayıları gösterir; date range filtreleri tüm widget'lara uygulanır.

---

## Faz 8 — MCP Yönetimi  ✅ TAMAMLANDI

> Doğrulandı (2026-06-22): **`features/settings/api-keys-page.tsx`** (rota `/settings/api-keys`, nav "API Anahtarları") — RBAC: yalnız owner/admin yönetir (viewer/analyst → bilgi kartı). **Oluşturma formu:** ad + **4 kapsam toggle** (`stores:read`/`profit:read`/`products:read`/`ads:read`, açıklamalı, varsayılan hepsi seçili). **Anahtar tablosu:** ad + `chk_…` prefix · kapsam rozetleri · son kullanım (yoksa "Hiç") · **iptal et** (iptalliler soluk + "İptal edildi" rozeti). **Oluşturulan-anahtar dialog'u:** ham anahtar **bir kez** (kopya butonu) + uyarı + hazır **Claude Desktop JSON** snippet (gerçek anahtarla, kopya). **Bağlanma talimatı kartı:** `MCP_ENDPOINT` URL (kopya) + placeholder'lı Claude config + MCP Inspector notu (Streamable HTTP + Authorization header). `lib/api`'ye `apiKeysApi` (list/create/revoke) + `MCP_ENDPOINT` eklendi; TanStack Query invalidation + sonner toast + `ApiError` mesajları. `tsc --noEmit` + `vite build` + `turbo run typecheck test build` (**9/9**) yeşil; API e2e ile uçtan uca: anahtar üret → MCP'ye bağlan → `get_profit_summary` REST ile birebir. Bağlanma dokümanı: [`packages/mcp/README.md`](../../packages/mcp/README.md).

- [x] `features/settings/api-keys`: MCP API key oluştur/iptal et, scope seçimi, son kullanım.
- [x] Bağlanma talimatı (Claude/ChatGPT) UI'da kopyalanabilir snippet.

**DoD:** Kullanıcı API key üretir; talimatla MCP istemcisine bağlanabilir.

---

## Faz 9 — Billing & Polish

> **Billing sağlayıcısı: [creem.io](https://creem.io) (Merchant of Record).** Stripe **kullanılmıyor**. İki abonelik planı — **Basic** ve **Pro** — ve **her plan 14 günlük ücretsiz deneme (free trial)** içerir. Plan limitleri (mağaza sayısı vb.) `packages/shared/billing.ts`'te tanımlı; gerçek fiyatlar/ürünler Creem panosunda konfigüre edilir (env: `CREEM_PRODUCT_BASIC`/`CREEM_PRODUCT_PRO`).

> Doğrulandı (2026-06-22): **`features/billing/billing-page.tsx`** (rota `/billing`, nav "Faturalandırma") — `billingApi` (`state`/`checkout`/`portal`/`devActivate`) `lib/api`'ye eklendi. **Mevcut plan kartı:** plan adı + durum rozeti (trialing/active/past_due/expired… renk-kodlu), "Ücretsiz deneme: X gün kaldı" / "Yenileme: <tarih>", **mağaza kullanımı** çubuğu (X/limit; limitte amber uyarı), `cancelAtPeriodEnd` banner'ı, owner/admin'e **"Faturalandırmayı yönet"** (Creem portal). **Plan kartları** (Basic/Pro): fiyat + özellik listesi (✓) + 14g deneme; mevcut plan rozetli/disabled; owner/admin değilse aksiyon gizli. **Akış:** prod'da "Planı seç" → Creem checkout `window.location`; **DEV'de "Dev etkinleştir"** → `dev-activate` (gerçek tahsilat yok). `?billing=success` dönüşünde toast + invalidation + URL temizleme. `tsc --noEmit` + `turbo run typecheck test build` **9/9** yeşil. (Onboarding/a11y/e2e bu fazda açık.)

- [x] `features/billing`: plan seçimi (Basic/Pro + 14g trial rozeti), **Creem hosted checkout** yönlendirmesi + **Creem customer portal** ("Faturalandırmayı yönet"), mevcut plan kartı (durum: trialing/active/past_due… + deneme bitişine kalan gün + dönem sonu), mağaza kullanımı (X/limit), plan gating UI (limit aşımı uyarıları). Dev modda (Creem anahtarı yokken) **Dev etkinleştir** ile plan simüle edilir.
- [x] Boş durumlar + onboarding akışı: `features/onboarding/onboarding-checklist.tsx` — pano üstünde 3 adımlı kontrol listesi (mağaza bağla → COGS gir → pano oluştur), adım-durumu canlı (stores/cogs/dashboards sorgularından), ilerleme çubuğu, kapatılabilir (localStorage), hepsi bitince gizlenir. **Etsy bağla** kartı entegrasyonlar sayfasına eklendi (OAuth + dev-connect). Pano/widget boş durumları zaten mevcut (Faz 7).
- [x] Erişilebilirlik + responsive: AppShell — "İçeriğe geç" skip-link, `<main id>` + `<nav aria-label>` landmark'ları, aktif linkte `aria-current="page"`, **mobil hamburger menü** (md altında sidebar gizliyken gezinme), ikon-butonlara `aria-label`, içerik padding responsive. **Playwright e2e** (`apps/web/e2e`, API mock'lu): auth (login redirect/validation/başarılı giriş) + app (onboarding görünür, billing Basic/Pro + 14g, kullanım 0/1) — **6/6 yeşil**; CI'da `e2e-web` job.

**DoD:** Plan yükseltme akışı (Creem checkout) çalışır; mevcut plan/deneme durumu görünür; limit aşımı uyarısı gösterilir; onboarding ilk kullanıcıyı panoya ulaştırır; e2e kritik akışlar yeşil.

> Doğrulandı (2026-06-22, **onboarding + a11y + e2e + Etsy UI**): onboarding kontrol listesi (3 adım, ilerleme + dismiss), AppShell a11y (skip-link/landmark/aria-current/mobil menü/aria-label) + responsive padding, entegrasyonlar sayfasına **Etsy bağla** kartı (`etsyInstall`/`etsyDevConnect`). **Playwright** (`pnpm --filter web test:e2e`, Vite webServer + `page.route` API mock) **6/6 yeşil**: oturumsuz→login, geçersiz gönderim login'de kalır, başarılı giriş→pano; onboarding + billing planları + kullanım. `tsc --noEmit` + `turbo run typecheck test build` **9/9** yeşil.
