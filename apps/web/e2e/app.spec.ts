import { expect, test } from "@playwright/test";
import { mockAuthenticated } from "./_mock";

test.describe("Kimliği doğrulanmış uygulama", () => {
  test("yeni org için onboarding kontrol listesi görünür", async ({ page }) => {
    await mockAuthenticated(page);
    await page.goto("/");
    await expect(page.getByText(/hoş geldin/i)).toBeVisible();
    await expect(page.getByText("İlk mağazanı bağla")).toBeVisible();
    await expect(page.getByText("Maliyetleri (COGS) gir")).toBeVisible();
  });

  test("faturalandırma sayfası Basic/Pro planları + 14 gün denemeyi gösterir", async ({
    page,
  }) => {
    await mockAuthenticated(page);
    await page.goto("/billing");
    await expect(
      page.getByRole("heading", { name: "Faturalandırma" }),
    ).toBeVisible();
    await expect(page.getByText("Basic", { exact: true })).toBeVisible();
    await expect(page.getByText("Pro", { exact: true })).toBeVisible();
    await expect(page.getByText(/14 gün ücretsiz deneme/i).first()).toBeVisible();
  });

  test("mağaza kullanımı 0/1 (free) gösterilir", async ({ page }) => {
    await mockAuthenticated(page);
    await page.goto("/billing");
    await expect(page.getByText("0 / 1")).toBeVisible();
  });
});
