import { expect, test } from "@playwright/test";
import { ME, SESSION, mockUnauthenticated } from "./_mock";

test.describe("Auth akışı", () => {
  test("oturumsuz ziyaret login'e yönlendirir", async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("E-posta")).toBeVisible();
    await expect(page.getByLabel("Parola")).toBeVisible();
  });

  test("geçersiz gönderimde login'de kalır", async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto("/login");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    // İstemci doğrulaması: yönlendirme olmaz.
    await expect(page).toHaveURL(/\/login$/);
  });

  test("başarılı giriş panoya götürür", async ({ page }) => {
    await mockUnauthenticated(page);
    // Giriş + sonrası için ek mock'lar (catch-all'dan sonra eklenir → öncelikli).
    await page.route("**/api/auth/login", (r) =>
      r.fulfill({ contentType: "application/json", body: JSON.stringify(SESSION) }),
    );
    await page.route("**/api/auth/me", (r) =>
      r.fulfill({ contentType: "application/json", body: JSON.stringify(ME) }),
    );
    await page.route("**/api/stores", (r) =>
      r.fulfill({ contentType: "application/json", body: "[]" }),
    );
    await page.route("**/api/dashboards", (r) =>
      r.fulfill({ contentType: "application/json", body: "[]" }),
    );

    await page.goto("/login");
    await page.getByLabel("E-posta").fill("owner@test.com");
    await page.getByLabel("Parola").fill("Passw0rd!23");
    await page.getByRole("button", { name: "Giriş yap" }).click();

    // Pano (kök) — AppShell'in "Churnify" markası görünür.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Churnify").first()).toBeVisible();
  });
});
