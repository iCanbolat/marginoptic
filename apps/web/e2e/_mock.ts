import type { Page } from "@playwright/test";

/** Test kullanıcı/organizasyon + yanıt payload'ları (shared sözleşmeyle hizalı). */
export const ORG = {
  id: "org-1",
  name: "Test Organizasyonu",
  slug: "test-org",
  role: "owner" as const,
};
export const USER = { id: "u-1", email: "owner@test.com", name: "Owner User" };
export const SESSION = { accessToken: "tok_test", user: USER, activeOrg: ORG };
export const ME = { user: USER, organizations: [ORG] };

export const BILLING_FREE = {
  plan: "free",
  status: "none",
  active: false,
  trialEndsAt: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  usage: { stores: 0, storeLimit: 1 },
  manageable: false,
};

/** Bir JSON yanıtı döndüren route helper. */
function json(page: Page, pattern: string, body: unknown, status = 200) {
  return page.route(pattern, (route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }),
  );
}

/**
 * Tüm /api isteklerini mock'lar — kimliği doğrulanmış oturum. Önce catch-all,
 * sonra özel uçlar (Playwright son eklenen route'u önceler).
 */
export async function mockAuthenticated(page: Page): Promise<void> {
  await json(page, "**/api/**", {}); // catch-all
  await json(page, "**/api/auth/refresh", SESSION);
  await json(page, "**/api/auth/me", ME);
  await json(page, "**/api/stores", []);
  await json(page, "**/api/dashboards", []);
  await json(page, "**/api/billing", BILLING_FREE);
}

/** Oturumsuz — refresh 401 (login'e yönlendirir). */
export async function mockUnauthenticated(page: Page): Promise<void> {
  await json(page, "**/api/**", {});
  await json(page, "**/api/auth/refresh", {}, 401);
}
