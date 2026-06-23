#!/usr/bin/env node
// @ts-check
/**
 * Dev seed: API ayaktayken bir demo hesabı oluşturur ve sentetik Shopify/Etsy/reklam
 * verisi bağlar, sonra rollup'lar bitene kadar bekler. Böylece web client'taki
 * dashboard/grafik componentleri gerçekçi veriyle görülebilir.
 *
 * Önkoşul (sırasıyla):
 *   pnpm docker:up
 *   pnpm db:migrate
 *   pnpm dev        (API http://localhost:3000 üzerinde çalışıyor olmalı)
 *
 * Çalıştır:  pnpm seed:dev
 *
 * Yapılandırma (env): API_URL, SEED_EMAIL, SEED_PASSWORD, SEED_NAME, SEED_ORG
 */

const API_URL = process.env.API_URL ?? "http://localhost:3000";
const BASE = `${API_URL}/api`;

const EMAIL = process.env.SEED_EMAIL ?? "demo@churnify.dev";
const PASSWORD = process.env.SEED_PASSWORD ?? "demodemo123";
const NAME = process.env.SEED_NAME ?? "Demo Kullanıcı";
const ORG = process.env.SEED_ORG ?? "Demo Organizasyon";

const SHOPIFY_SHOP = "demo-store.myshopify.com";
const ETSY_SHOP = "demo-etsy-shop";

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

async function ensureSession() {
  try {
    const s = await api("/auth/register", {
      method: "POST",
      auth: false,
      body: { email: EMAIL, password: PASSWORD, name: NAME, organizationName: ORG },
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

/**
 * Bir mağazanın tüm sync kaynakları `complete` olana kadar bekler.
 * @param {string} storeId
 * @param {string} label
 */
async function waitForSync(storeId, label) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const status = await api(`/stores/${storeId}/sync`);
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

  // Pro planı etkinleştir — ücretsiz plan 1 mağazayla sınırlı; demo için çok mağaza isteriz.
  try {
    await api("/billing/dev-activate", { method: "POST", body: { plan: "pro" } });
    console.log("✓ Pro plan etkinleştirildi (mağaza limiti açıldı)");
  } catch (e) {
    console.warn(`⚠ Plan etkinleştirme atlandı: ${e?.message ?? e}`);
  }

  const shopify = await api("/integrations/shopify/dev-connect", {
    method: "POST",
    body: { shop: SHOPIFY_SHOP },
  });
  console.log(`✓ Shopify dev mağaza bağlandı (${SHOPIFY_SHOP})`);

  // Reklam bağlantısı mevcut bir mağaza ister — Shopify mağazasına bağla.
  try {
    await api("/integrations/ads/meta_ads/dev-connect", {
      method: "POST",
      body: { storeId: shopify.storeId, externalAccountId: "act_demo" },
    });
    console.log("✓ Meta Ads dev hesabı bağlandı (act_demo)");
  } catch (e) {
    console.warn(`⚠ Reklam bağlantısı atlandı: ${e?.message ?? e}`);
  }

  // Etsy ikinci mağaza — limit/başka bir nedenle başarısız olursa seed'i bozma.
  let etsy = null;
  try {
    etsy = await api("/integrations/etsy/dev-connect", {
      method: "POST",
      body: { shop: ETSY_SHOP },
    });
    console.log(`✓ Etsy dev mağaza bağlandı (${ETSY_SHOP})`);
  } catch (e) {
    console.warn(`⚠ Etsy bağlantısı atlandı: ${e?.message ?? e}`);
  }

  await waitForSync(shopify.storeId, "Shopify");
  if (etsy) await waitForSync(etsy.storeId, "Etsy");

  console.log("\n──────────────────────────────────────────");
  console.log("✅ Seed tamamlandı. Giriş bilgileri:");
  console.log(`   E-posta : ${EMAIL}`);
  console.log(`   Parola  : ${PASSWORD}`);
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
