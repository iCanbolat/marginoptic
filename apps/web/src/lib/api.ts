import type {
  AdConnectInput,
  AdLevel,
  AdProvider,
  AdsPerformanceResponse,
  ApiKeyCreateInput,
  ApiKeyCreatedResponse,
  ApiKeySummary,
  BillingRedirectResponse,
  BillingState,
  PlanId,
  CustomerCacResponse,
  CustomerCohortsResponse,
  CustomerLtvResponse,
  CustomMetricCreateInput,
  CustomMetricSummary,
  CustomMetricUpdateInput,
  CustomMetricValuesResponse,
  DashboardCreateInput,
  DashboardDetail,
  DashboardSummary,
  DashboardUpdateInput,
  DashboardWidgetsInput,
  PnlResponse,
  ProductRankingResponse,
  ProfitSummaryResponse,
  StoreComparisonResponse,
  TimeseriesResponse,
  CogsCsvImportInput,
  CogsCsvImportResult,
  CogsRuleInput,
  CogsRuleSummary,
  CogsRuleUpdate,
  CostResolution,
  CustomExpenseInput,
  CustomExpenseSummary,
  CustomExpenseUpdate,
  ExpenseAllocationRow,
  HealthResponse,
  IntegrationsOverview,
  InvitationCreatedResponse,
  InvitationView,
  InviteMemberInput,
  LoginInput,
  MemberView,
  MeResponse,
  OrderRow,
  OrgSummary,
  Paginated,
  PaymentFeeRuleInput,
  PaymentFeeRuleSummary,
  RegisterInput,
  Role,
  SessionResponse,
  ShippingRuleInput,
  ShippingRuleSummary,
  ShopifyInstallResponse,
  StoreSummary,
  StoreSyncStatus,
  SwitchOrgResponse,
  TaxConfigInput,
  TaxConfigSummary,
} from "@churnify/shared";
import { useAuthStore } from "./auth/store";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/** MCP Streamable HTTP ucu — per-org API key ile erişilir (Faz 8). */
export const MCP_ENDPOINT = `${API_URL}/api/mcp`;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly issues?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function toError(res: Response): Promise<ApiError> {
  let message = `İstek başarısız (${res.status})`;
  let issues: { path: string; message: string }[] | undefined;
  try {
    const body = await res.json();
    const err = body?.error ?? body;
    if (typeof err?.message === "string") message = err.message;
    if (Array.isArray(err?.issues)) issues = err.issues;
  } catch {
    /* gövde JSON değil */
  }
  return new ApiError(res.status, message, issues);
}

function request(
  path: string,
  init: RequestInit | undefined,
  token: string | null,
): Promise<Response> {
  return fetch(`${API_URL}/api${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
}

// Aynı anda birden fazla 401 olursa tek bir refresh çalışsın
let refreshing: Promise<string | null> | null = null;

function refreshSession(): Promise<string | null> {
  refreshing ??= (async () => {
    const res = await request("/auth/refresh", { method: "POST" }, null);
    if (!res.ok) {
      useAuthStore.getState().clear();
      return null;
    }
    const session = (await res.json()) as SessionResponse;
    useAuthStore.getState().setSession(session);
    return session.accessToken;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Auth'lu istek: access token ekler, 401'de bir kez refresh deneyip tekrar dener. */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  let res = await request(path, init, token);

  if (res.status === 401 && token) {
    const next = await refreshSession();
    if (next) res = await request(path, init, next);
  }

  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// --- Public (token gerektirmeyen) çağrılar ---

async function publicPost<T>(path: string, body: unknown): Promise<T> {
  const res = await request(path, { method: "POST", body: JSON.stringify(body) }, null);
  if (!res.ok) throw await toError(res);
  return (await res.json()) as T;
}

export const authApi = {
  register: (input: RegisterInput) =>
    publicPost<SessionResponse>("/auth/register", input),
  login: (input: LoginInput) => publicPost<SessionResponse>("/auth/login", input),
  async logout(): Promise<void> {
    await request("/auth/logout", { method: "POST" }, null);
    useAuthStore.getState().clear();
  },
  refresh: refreshSession,
  me: () => apiFetch<MeResponse>("/auth/me"),
  switchOrg: (organizationId: string) =>
    apiFetch<SwitchOrgResponse>("/auth/switch-org", {
      method: "POST",
      body: JSON.stringify({ organizationId }),
    }),
};

export const orgApi = {
  list: () => apiFetch<OrgSummary[]>("/organizations"),
  create: (name: string) =>
    apiFetch<OrgSummary>("/organizations", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  members: () => apiFetch<MemberView[]>("/organizations/members"),
  invitations: () => apiFetch<InvitationView[]>("/organizations/invitations"),
  invite: (input: InviteMemberInput) =>
    apiFetch<InvitationCreatedResponse>("/organizations/invitations", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateRole: (userId: string, role: Exclude<Role, "owner">) =>
    apiFetch<{ ok: true }>(`/organizations/members/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
  removeMember: (userId: string) =>
    apiFetch<void>(`/organizations/members/${userId}`, { method: "DELETE" }),
};

export const integrationsApi = {
  overview: () => apiFetch<IntegrationsOverview>("/integrations"),
  shopifyInstall: (shop: string) =>
    apiFetch<ShopifyInstallResponse>(
      `/integrations/shopify/install?shop=${encodeURIComponent(shop)}`,
    ),
  devConnect: (shop: string) =>
    apiFetch<{ storeId: string; connectionId: string }>(
      "/integrations/shopify/dev-connect",
      { method: "POST", body: JSON.stringify({ shop }) },
    ),
  etsyInstall: () =>
    apiFetch<ShopifyInstallResponse>("/integrations/etsy/install"),
  etsyDevConnect: (shop: string) =>
    apiFetch<{ storeId: string; connectionId: string }>(
      "/integrations/etsy/dev-connect",
      { method: "POST", body: JSON.stringify({ shop }) },
    ),
  disconnect: (connectionId: string) =>
    apiFetch<void>(`/integrations/${connectionId}`, { method: "DELETE" }),
  adInstall: (provider: AdProvider, storeId: string) =>
    apiFetch<ShopifyInstallResponse>(
      `/integrations/ads/${provider}/install?storeId=${encodeURIComponent(storeId)}`,
    ),
  adDevConnect: (provider: AdProvider, input: AdConnectInput) =>
    apiFetch<{ connectionId: string; provider: AdProvider }>(
      `/integrations/ads/${provider}/dev-connect`,
      { method: "POST", body: JSON.stringify(input) },
    ),
};

export const storesApi = {
  list: () => apiFetch<StoreSummary[]>("/stores"),
};

export interface AdsPerformanceParams {
  from: string;
  to: string;
  level?: AdLevel;
}

export const adsApi = {
  performance: (storeId: string, params: AdsPerformanceParams) => {
    const qs = new URLSearchParams({ from: params.from, to: params.to });
    if (params.level) qs.set("level", params.level);
    return apiFetch<AdsPerformanceResponse>(
      `/stores/${storeId}/ads/performance?${qs.toString()}`,
    );
  },
};

export interface OrdersParams {
  limit?: number;
  cursor?: string;
  financialStatus?: string;
  search?: string;
}

export const ingestionApi = {
  syncStatus: (storeId: string) =>
    apiFetch<StoreSyncStatus>(`/stores/${storeId}/sync`),
  orders: (storeId: string, params: OrdersParams = {}) => {
    const qs = new URLSearchParams();
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    if (params.financialStatus) qs.set("financialStatus", params.financialStatus);
    if (params.search) qs.set("search", params.search);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<Paginated<OrderRow>>(`/stores/${storeId}/orders${suffix}`);
  },
};

// --- Faz 4: Maliyet modelleme ---

export interface CostResolveParams {
  sku?: string;
  variantExternalId?: string;
  productExternalId?: string;
  quantity?: number;
  country?: string;
  weightGrams?: number;
  gateway?: string;
  amount?: string;
}

export const costsApi = {
  // COGS
  listCogs: (storeId: string) =>
    apiFetch<CogsRuleSummary[]>(`/stores/${storeId}/costs/cogs`),
  createCogs: (storeId: string, input: CogsRuleInput) =>
    apiFetch<CogsRuleSummary>(`/stores/${storeId}/costs/cogs`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateCogs: (storeId: string, id: string, input: CogsRuleUpdate) =>
    apiFetch<CogsRuleSummary>(`/stores/${storeId}/costs/cogs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteCogs: (storeId: string, id: string) =>
    apiFetch<void>(`/stores/${storeId}/costs/cogs/${id}`, { method: "DELETE" }),
  importCogs: (storeId: string, input: CogsCsvImportInput) =>
    apiFetch<CogsCsvImportResult>(`/stores/${storeId}/costs/cogs/import`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // Kargo
  listShipping: (storeId: string) =>
    apiFetch<ShippingRuleSummary[]>(`/stores/${storeId}/costs/shipping`),
  createShipping: (storeId: string, input: ShippingRuleInput) =>
    apiFetch<ShippingRuleSummary>(`/stores/${storeId}/costs/shipping`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deleteShipping: (storeId: string, id: string) =>
    apiFetch<void>(`/stores/${storeId}/costs/shipping/${id}`, {
      method: "DELETE",
    }),

  // Ödeme ücreti
  listPaymentFees: (storeId: string) =>
    apiFetch<PaymentFeeRuleSummary[]>(`/stores/${storeId}/costs/payment-fees`),
  createPaymentFee: (storeId: string, input: PaymentFeeRuleInput) =>
    apiFetch<PaymentFeeRuleSummary>(`/stores/${storeId}/costs/payment-fees`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deletePaymentFee: (storeId: string, id: string) =>
    apiFetch<void>(`/stores/${storeId}/costs/payment-fees/${id}`, {
      method: "DELETE",
    }),

  // Vergi
  getTax: (storeId: string) =>
    apiFetch<TaxConfigSummary>(`/stores/${storeId}/costs/tax`),
  putTax: (storeId: string, input: TaxConfigInput) =>
    apiFetch<TaxConfigSummary>(`/stores/${storeId}/costs/tax`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  // Çözümleme (debug)
  resolve: (storeId: string, params: CostResolveParams) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== "") qs.set(k, String(v));
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<CostResolution>(`/stores/${storeId}/costs/resolve${suffix}`);
  },
};

export const expensesApi = {
  list: (storeId?: string) => {
    const suffix = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
    return apiFetch<CustomExpenseSummary[]>(`/costs/expenses${suffix}`);
  },
  create: (input: CustomExpenseInput) =>
    apiFetch<CustomExpenseSummary>("/costs/expenses", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: CustomExpenseUpdate) =>
    apiFetch<CustomExpenseSummary>(`/costs/expenses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    apiFetch<void>(`/costs/expenses/${id}`, { method: "DELETE" }),
  allocations: (id: string, from: string, to: string) =>
    apiFetch<ExpenseAllocationRow[]>(
      `/costs/expenses/${id}/allocations?from=${from}&to=${to}`,
    ),
  materialize: (id: string, from: string, to: string) =>
    apiFetch<{ queued: true }>(`/costs/expenses/${id}/materialize`, {
      method: "POST",
      body: JSON.stringify({ from, to }),
    }),
};

// --- Faz 7: Analytics & Pano ---

export interface AnalyticsFilterParams {
  from: string;
  to: string;
  /** boş/atlanırsa org'un tüm mağazaları. */
  storeIds?: string[];
  compare?: boolean;
}

function analyticsQs(
  f: AnalyticsFilterParams,
  extra?: Record<string, string | number | undefined>,
): string {
  const qs = new URLSearchParams({ from: f.from, to: f.to });
  if (f.storeIds && f.storeIds.length > 0) qs.set("storeIds", f.storeIds.join(","));
  if (f.compare) qs.set("compare", "true");
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v != null) qs.set(k, String(v));
    }
  }
  return qs.toString();
}

export const analyticsApi = {
  profitSummary: (f: AnalyticsFilterParams) =>
    apiFetch<ProfitSummaryResponse>(`/analytics/profit-summary?${analyticsQs(f)}`),
  pnl: (f: AnalyticsFilterParams) =>
    apiFetch<PnlResponse>(`/analytics/pnl?${analyticsQs(f)}`),
  timeseries: (f: AnalyticsFilterParams) =>
    apiFetch<TimeseriesResponse>(`/analytics/timeseries?${analyticsQs(f)}`),
  storeComparison: (f: AnalyticsFilterParams) =>
    apiFetch<StoreComparisonResponse>(
      `/analytics/store-comparison?${analyticsQs(f)}`,
    ),
  products: (f: AnalyticsFilterParams, limit = 20) =>
    apiFetch<ProductRankingResponse>(
      `/analytics/products?${analyticsQs(f, { limit })}`,
    ),
  adsPerformance: (f: AnalyticsFilterParams, level: AdLevel = "campaign") =>
    apiFetch<AdsPerformanceResponse>(
      `/analytics/ads/performance?${analyticsQs(f, { level })}`,
    ),
  ltv: (f: AnalyticsFilterParams) =>
    apiFetch<CustomerLtvResponse>(`/analytics/customers/ltv?${analyticsQs(f)}`),
  cac: (f: AnalyticsFilterParams) =>
    apiFetch<CustomerCacResponse>(`/analytics/customers/cac?${analyticsQs(f)}`),
  cohorts: (f: AnalyticsFilterParams) =>
    apiFetch<CustomerCohortsResponse>(
      `/analytics/customers/cohorts?${analyticsQs(f)}`,
    ),
  customMetricValues: (f: AnalyticsFilterParams) =>
    apiFetch<CustomMetricValuesResponse>(
      `/custom-metrics/values?${analyticsQs(f)}`,
    ),
};

export const dashboardsApi = {
  list: () => apiFetch<DashboardSummary[]>("/dashboards"),
  get: (id: string) => apiFetch<DashboardDetail>(`/dashboards/${id}`),
  create: (input: DashboardCreateInput) =>
    apiFetch<DashboardDetail>("/dashboards", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: DashboardUpdateInput) =>
    apiFetch<DashboardDetail>(`/dashboards/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    apiFetch<void>(`/dashboards/${id}`, { method: "DELETE" }),
  saveWidgets: (id: string, input: DashboardWidgetsInput) =>
    apiFetch<DashboardDetail>(`/dashboards/${id}/widgets`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
};

export const customMetricsApi = {
  list: () => apiFetch<CustomMetricSummary[]>("/custom-metrics"),
  create: (input: CustomMetricCreateInput) =>
    apiFetch<CustomMetricSummary>("/custom-metrics", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: CustomMetricUpdateInput) =>
    apiFetch<CustomMetricSummary>(`/custom-metrics/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    apiFetch<void>(`/custom-metrics/${id}`, { method: "DELETE" }),
};

// --- Faz 8: MCP API key yönetimi ---

export const apiKeysApi = {
  list: () => apiFetch<ApiKeySummary[]>("/api-keys"),
  create: (input: ApiKeyCreateInput) =>
    apiFetch<ApiKeyCreatedResponse>("/api-keys", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  revoke: (id: string) =>
    apiFetch<void>(`/api-keys/${id}`, { method: "DELETE" }),
};

// --- Faz 9: Faturalandırma (creem.io) ---

export const billingApi = {
  state: () => apiFetch<BillingState>("/billing"),
  checkout: (plan: PlanId) =>
    apiFetch<BillingRedirectResponse>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan }),
    }),
  portal: () =>
    apiFetch<BillingRedirectResponse>("/billing/portal", { method: "POST" }),
  devActivate: (plan: PlanId) =>
    apiFetch<BillingState>("/billing/dev-activate", {
      method: "POST",
      body: JSON.stringify({ plan }),
    }),
};

/** Health endpoint /api prefix'i dışında. */
export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) throw await toError(res);
  return (await res.json()) as HealthResponse;
}
