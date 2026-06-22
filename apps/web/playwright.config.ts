import { defineConfig, devices } from "@playwright/test";

/**
 * Faz 9 — Web e2e (Playwright). Kritik akışlar API mock'lanarak test edilir
 * (network `page.route` ile), böylece backend/DB olmadan CI'da hızlı + kararlı.
 * `webServer` Vite dev sunucusunu otomatik başlatır.
 */
const PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
