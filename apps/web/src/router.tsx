import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { useAuthStore } from "@/lib/auth/store";
import { authApi } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { LoginPage } from "@/features/auth/login-page";
import { RegisterPage } from "@/features/auth/register-page";
import { AuthCallbackPage } from "@/features/auth/auth-callback-page";
import { StoresPage } from "@/features/settings/stores-page";
import { ApiKeysPage } from "@/features/settings/api-keys-page";
import { BillingPage } from "@/features/billing/billing-page";
import { IntegrationsPage } from "@/features/integrations/integrations-page";
import { OrdersPage } from "@/features/orders/orders-page";
import { CostsPage } from "@/features/costs/costs-page";
import { AdsPage } from "@/features/ads/ads-page";
import { ProductsPage } from "@/features/products/products-page";
import { ChartsPreviewPage } from "@/features/preview/charts-preview";

const rootRoute = createRootRoute({ component: () => <Outlet /> });

/** Kimlik doğrulaması gereken alan — AppShell (sidebar/topbar) içinde render edilir. */
const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: AppShell,
  beforeLoad: () => {
    if (!useAuthStore.getState().accessToken) {
      throw redirect({ to: "/login" });
    }
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/",
  component: DashboardPage,
});

const integrationsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/integrations",
  component: IntegrationsPage,
});

const ordersRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/orders",
  component: OrdersPage,
});

const productsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/products",
  component: ProductsPage,
});

const costsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/costs",
  component: CostsPage,
});

const adsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/ads",
  component: AdsPage,
});

const storesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings/stores",
  component: StoresPage,
});

const apiKeysRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings/api-keys",
  component: ApiKeysPage,
});

const billingRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/billing",
  component: BillingPage,
});

// Faz 5 iç önizleme: grafik/biçimlendirme primitive'leri (nav'da gösterilmez).
const chartsPreviewRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/preview/charts",
  component: ChartsPreviewPage,
});

const redirectIfAuthed = () => {
  if (useAuthStore.getState().accessToken) {
    throw redirect({ to: "/" });
  }
};

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
  beforeLoad: redirectIfAuthed,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: RegisterPage,
  beforeLoad: redirectIfAuthed,
});

/**
 * Google OAuth dönüşü: backend `churnify_rt` cookie'sini set etmiş olur.
 * Burada refresh ile access token + oturum alınır, sonra panoya yönlendirilir.
 */
const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/callback",
  component: AuthCallbackPage,
  beforeLoad: async () => {
    const token = await authApi.refresh();
    throw redirect({ to: token ? "/" : "/login" });
  },
});

const routeTree = rootRoute.addChildren([
  appLayoutRoute.addChildren([
    dashboardRoute,
    integrationsRoute,
    ordersRoute,
    productsRoute,
    costsRoute,
    adsRoute,
    storesRoute,
    apiKeysRoute,
    billingRoute,
    chartsPreviewRoute,
  ]),
  loginRoute,
  registerRoute,
  authCallbackRoute,
]);

export const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
