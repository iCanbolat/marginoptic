#!/usr/bin/env node
// @ts-check
/**
 * Dev seed: API ayaktayken bir demo hesabı oluşturur, kullanıcıya ait iki mağaza
 * (store) kurar, her birine satış kanalları (Shopify/Amazon/eBay) + reklam bağlar,
 * maliyet kuralları + özel giderleri ekler ve sentetik sync/rollup zincirini bekler.
 * Böylece web client'taki tüm sayfalar (dashboard/orders/products/ads/costs) gerçek
 * veriyle dolu görünür — mock yok.
 *
 * Önkoşul (sırasıyla):
 *   pnpm docker:up
 *   pnpm db:migrate
 *   pnpm dev        (API http://localhost:3000 üzerinde çalışıyor olmalı)
 *
 * Çalıştır:  pnpm seed:dev
 *
 * Yapılandırma (env): API_URL, SEED_EMAIL, SEED_PASSWORD, SEED_NAME
 */

const API_URL = process.env.API_URL ?? "http://localhost:3000";
const BASE = `${API_URL}/api`;

const EMAIL = process.env.SEED_EMAIL ?? "demo@churnify.dev";
const PASSWORD = process.env.SEED_PASSWORD ?? "demodemo123";
const NAME = process.env.SEED_NAME ?? "Demo Kullanıcı";

/** @type {string} */
let token = "";

/**
 * @param {string} path
 * @param {{ method?: string, body?: unknown, auth?: boolean }} [opts]
 */
async function api(path, opts = {}) {
  const { method = "GET", body, auth = true } = opts;
  const headers = { "Content-Type": "application/json" };
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(
      `${method} ${path} → ${res.status}: ${data?.message ?? text}`,
    );
    // @ts-expect-error ek alan
    err.status = res.status;
    throw err;
  }
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const todayIso = () => new Date().toISOString().slice(0, 10);

async function ensureSession() {
  try {
    const s = await api("/auth/register", {
      method: "POST",
      auth: false,
      body: { email: EMAIL, password: PASSWORD, name: NAME, storeName: "Foo Store" },
    });
    token = s.accessToken;
    console.log(`✓ Hesap oluşturuldu: ${EMAIL}`);
  } catch (e) {
    if (e && e.status === 409) {
      const s = await api("/auth/login", {
        method: "POST",
        auth: false,
        body: { email: EMAIL, password: PASSWORD },
      });
      token = s.accessToken;
      console.log(`✓ Mevcut hesapla giriş yapıldı: ${EMAIL}`);
    } else {
      throw e;
    }
  }
}

/** Aktif mağazayı değiştirir (token'ı günceller). @param {string} storeId */
async function switchStore(storeId) {
  const res = await api("/auth/switch-store", {
    method: "POST",
    body: { storeId },
  });
  token = res.accessToken;
  return res.activeStore;
}

/**
 * İsimle mağaza (store=grup) bulur; yoksa oluşturur. Aktif mağaza ona çevrilir.
 * @param {string} name
 * @returns {Promise<string>} store (grup) id
 */
async function ensureStore(name) {
  const stores = await api("/stores");
  const found = stores.find((s) => s.name === name);
  const store = found ?? (await api("/stores", { method: "POST", body: { name } }));
  if (!found) console.log(`✓ Mağaza oluşturuldu: ${name}`);
  await switchStore(store.id);
  return store.id;
}

/** Aktif mağazaya bir satış kanalı bağlar (idempotent dev-connect). */
async function connectChannel(provider, shop) {
  const res = await api(`/integrations/${provider}/dev-connect`, {
    method: "POST",
    body: { shop },
  });
  console.log(`  ✓ ${provider} bağlandı (${shop}) → channel ${res.channelId.slice(0, 8)}`);
  return res; // { channelId (per-channel), connectionId }
}

/** Bir kanal (per-channel store) için maliyet kuralları + giderleri seed eder. */
async function seedCostsForChannel(channelStoreId, label) {
  // Tekrar çalıştırmada çoğaltma: zaten kural varsa atla.
  const existing = await api(`/channels/${channelStoreId}/costs/cogs`);
  if (existing.length > 0) {
    console.log(`  • ${label}: maliyet kuralları zaten var, atlandı`);
    return;
  }
  await api(`/channels/${channelStoreId}/costs/cogs`, {
    method: "POST",
    body: { scope: "global", costAmount: "8.50", handlingFee: "0.75", currency: "USD" },
  });
  await api(`/channels/${channelStoreId}/costs/shipping`, {
    method: "POST",
    body: { name: "Standart kargo", baseCost: "3.50", perItemCost: "0.50", currency: "USD" },
  });
  await api(`/channels/${channelStoreId}/costs/payment-fees`, {
    method: "POST",
    body: { gateway: "default", percentage: "2.9", fixedFee: "0.30", currency: "USD" },
  });
  await api(`/channels/${channelStoreId}/costs/tax`, {
    method: "PUT",
    body: { salesTaxBorne: false, incomeTaxRate: "18" },
  });
  // Mağazaya özel sabit gider + hesap geneline yayılan gider.
  await api("/costs/expenses", {
    method: "POST",
    body: {
      name: "Ofis kirası",
      category: "Genel gider",
      type: "recurring",
      recurrence: "monthly",
      allocation: "store",
      channelId: channelStoreId,
      amount: "1200",
      currency: "USD",
      startDate: `${todayIso().slice(0, 4)}-01-01`,
    },
  });
  console.log(`  ✓ ${label}: COGS + kargo + ödeme ücreti + vergi + gider eklendi`);
}

/**
 * Bir kanalın sync kaynakları `complete` olana kadar bekler.
 * @param {string} channelStoreId @param {string} label
 */
async function waitForSync(channelStoreId, label) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const status = await api(`/channels/${channelStoreId}/sync`);
    if (status.complete) {
      console.log(`✓ ${label} senkronizasyonu tamamlandı`);
      return;
    }
    const errored = (status.resources ?? []).filter((r) => r.status === "error");
    if (errored.length) {
      console.warn(
        `⚠ ${label} bazı kaynaklarda hata: ${errored.map((r) => r.resource).join(", ")}`,
      );
    }
    await sleep(2000);
  }
  console.warn(`⚠ ${label} senkronizasyonu zaman aşımına uğradı (devam ediyor olabilir)`);
}

async function main() {
  console.log(`→ Seed başlıyor (API: ${API_URL})`);
  await ensureSession();

  // Pro plan — ücretsiz plan 1 mağazayla sınırlı; demo için çok mağaza isteriz.
  try {
    await api("/billing/dev-activate", { method: "POST", body: { plan: "pro" } });
    console.log("✓ Pro plan etkinleştirildi (mağaza limiti açıldı)");
  } catch (e) {
    console.warn(`⚠ Plan etkinleştirme atlandı: ${e?.message ?? e}`);
  }

  // NOT: kanal/maliyet/sync uçları AKTİF mağaza (store grubu) bağlamında çalışır.
  // Bu yüzden her mağaza ayaktayken o mağazanın tüm işini bitiriyoruz.

  // ── Mağaza 1: "Foo Store" → Shopify + Amazon (+ Meta Ads) ──
  console.log("\n▸ Foo Store");
  await ensureStore("Foo Store");
  const fooShopify = await connectChannel("shopify", "foo-store.myshopify.com");
  const fooAmazon = await connectChannel("amazon", "FooStoreAmazon");
  try {
    await api("/integrations/ads/meta_ads/dev-connect", {
      method: "POST",
      body: { channelId: fooShopify.channelId, externalAccountId: "act_demo_foo" },
    });
    console.log("  ✓ Meta Ads bağlandı (act_demo_foo)");
  } catch (e) {
    console.warn(`  ⚠ Reklam bağlantısı atlandı: ${e?.message ?? e}`);
  }
  await seedCostsForChannel(fooShopify.channelId, "Foo/Shopify");
  await seedCostsForChannel(fooAmazon.channelId, "Foo/Amazon");
  await waitForSync(fooShopify.channelId, "Foo/Shopify");
  await waitForSync(fooAmazon.channelId, "Foo/Amazon");

  // ── Mağaza 2: "ABC Store" → sadece Shopify ──
  console.log("\n▸ ABC Store");
  await ensureStore("ABC Store");
  const abcShopify = await connectChannel("shopify", "abc-store.myshopify.com");
  await seedCostsForChannel(abcShopify.channelId, "ABC/Shopify");
  await waitForSync(abcShopify.channelId, "ABC/Shopify");

  console.log("\n──────────────────────────────────────────");
  console.log("✅ Seed tamamlandı. Giriş bilgileri:");
  console.log(`   E-posta : ${EMAIL}`);
  console.log(`   Parola  : ${PASSWORD}`);
  console.log("   Mağazalar: Foo Store (Shopify+Amazon), ABC Store (Shopify)");
  console.log("   Web     : http://localhost:5173/login");
  console.log("──────────────────────────────────────────");
}

main().catch((e) => {
  console.error(`\n✗ Seed başarısız: ${e?.message ?? e}`);
  if (e?.status === undefined && String(e?.message ?? "").includes("fetch")) {
    console.error("  API çalışıyor mu? Önce: pnpm docker:up && pnpm db:migrate && pnpm dev");
  }
  process.exit(1);
});
