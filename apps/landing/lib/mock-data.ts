/**
 * Static demo data for the landing showcases. Figures are internally consistent
 * (the P&L lines below sum exactly to Net Profit) so the story stays believable.
 *
 *   Revenue 248,500
 *   − Discounts 12,400 − Returns 9,800 − COGS 86,200 − Shipping 18,300
 *   − Fees 7,450 − Taxes 6,200 − Ad Spend 52,600 − Custom Expenses 9,100
 *   = Net Profit 46,450  (18.7% margin)
 */

export const REVENUE = 248_500;
export const NET_PROFIT = 46_450;
export const NET_MARGIN = 18.7;
export const AD_SPEND = 52_600;

export type Trend = { value: string; positive: boolean };

export type Kpi = {
  key: string;
  label: string;
  value: number;
  display: string;
  trend: Trend;
};

export const KPIS: Kpi[] = [
  {
    key: "netProfit",
    label: "Net Profit",
    value: NET_PROFIT,
    display: "$46,450",
    trend: { value: "+12.4%", positive: true },
  },
  {
    key: "revenue",
    label: "Revenue",
    value: REVENUE,
    display: "$248,500",
    trend: { value: "+8.1%", positive: true },
  },
  {
    key: "adSpend",
    label: "Ad Spend",
    value: AD_SPEND,
    display: "$52,600",
    trend: { value: "+5.3%", positive: false },
  },
  {
    key: "margin",
    label: "Net Margin",
    value: NET_MARGIN,
    display: "18.7%",
    trend: { value: "+2.2 pts", positive: true },
  },
];

/** Daily revenue vs net profit (compact 14-point series for the area chart). */
export type SeriesPoint = { label: string; revenue: number; profit: number };
export const SERIES: SeriesPoint[] = [
  { label: "1", revenue: 6200, profit: 980 },
  { label: "3", revenue: 7100, profit: 1240 },
  { label: "5", revenue: 6800, profit: 1120 },
  { label: "7", revenue: 8300, profit: 1560 },
  { label: "9", revenue: 7900, profit: 1410 },
  { label: "11", revenue: 9200, profit: 1820 },
  { label: "13", revenue: 8800, profit: 1690 },
  { label: "15", revenue: 10100, profit: 2050 },
  { label: "17", revenue: 9600, profit: 1880 },
  { label: "19", revenue: 11200, profit: 2360 },
  { label: "21", revenue: 10400, profit: 2110 },
  { label: "23", revenue: 12100, profit: 2640 },
  { label: "25", revenue: 11600, profit: 2480 },
  { label: "27", revenue: 13200, profit: 2960 },
];

/** Cost breakdown donut segments (sum = 202,050 = Revenue − Net Profit). */
export type CostSegment = { label: string; value: number; color: string };
export const COST_SEGMENTS: CostSegment[] = [
  { label: "COGS", value: 86_200, color: "var(--chart-1)" },
  { label: "Ad Spend", value: 52_600, color: "var(--chart-2)" },
  { label: "Shipping", value: 18_300, color: "var(--chart-3)" },
  { label: "Discounts", value: 12_400, color: "var(--chart-4)" },
  { label: "Refunds", value: 9_800, color: "var(--chart-5)" },
  { label: "Custom", value: 9_100, color: "var(--accent-teal)" },
  { label: "Fees", value: 7_450, color: "var(--accent-amber)" },
  { label: "Taxes", value: 6_200, color: "var(--muted-foreground)" },
];

/** Profit & loss waterfall — also drives the net-profit explainer. */
export type PnlRow = {
  label: string;
  amount: number;
  kind: "base" | "subtract" | "result";
  pct: string;
};
export const PNL: PnlRow[] = [
  { label: "Gross Sales", amount: 248_500, kind: "base", pct: "100%" },
  { label: "Discounts", amount: -12_400, kind: "subtract", pct: "5.0%" },
  { label: "Returns", amount: -9_800, kind: "subtract", pct: "3.9%" },
  { label: "COGS", amount: -86_200, kind: "subtract", pct: "34.7%" },
  { label: "Shipping", amount: -18_300, kind: "subtract", pct: "7.4%" },
  { label: "Payment Fees", amount: -7_450, kind: "subtract", pct: "3.0%" },
  { label: "Taxes", amount: -6_200, kind: "subtract", pct: "2.5%" },
  { label: "Ad Spend", amount: -52_600, kind: "subtract", pct: "21.2%" },
  { label: "Custom Expenses", amount: -9_100, kind: "subtract", pct: "3.7%" },
  { label: "Net Profit", amount: 46_450, kind: "result", pct: "18.7%" },
];

/** Per-product profitability (Product Analysis showcase). */
export type Channel = "shopify" | "amazon" | "ebay";
export type Product = {
  title: string;
  channel: Channel;
  units: number;
  revenue: number;
  adSpend: number;
  roas: number;
  conversion: number;
  netProfit: number;
};
export const PRODUCTS: Product[] = [
  { title: "Aurora Linen Throw", channel: "shopify", units: 1240, revenue: 38_440, adSpend: 6_200, roas: 4.1, conversion: 3.8, netProfit: 9_310 },
  { title: "Lumen Desk Lamp", channel: "shopify", units: 540, revenue: 18_360, adSpend: 2_250, roas: 6.4, conversion: 5.1, netProfit: 6_120 },
  { title: "Pulse Resistance Bands", channel: "amazon", units: 3420, revenue: 27_360, adSpend: 5_900, roas: 3.1, conversion: 2.9, netProfit: 5_980 },
  { title: "Sienna Ceramic Vase", channel: "shopify", units: 760, revenue: 22_800, adSpend: 3_100, roas: 5.2, conversion: 4.6, netProfit: 7_640 },
  { title: "Nomad Travel Mug 500ml", channel: "amazon", units: 2980, revenue: 41_720, adSpend: 11_300, roas: 2.45, conversion: 2.1, netProfit: 4_180 },
  { title: "Drift Wireless Earbuds", channel: "ebay", units: 1510, revenue: 52_850, adSpend: 19_400, roas: 1.35, conversion: 1.4, netProfit: -2_260 },
];

export type OverviewCard = {
  label: string;
  metric: string;
  product: string;
  channel: Channel;
  icon: "units" | "revenue" | "profit" | "conversion";
};
export const PRODUCT_OVERVIEW: OverviewCard[] = [
  { label: "Top seller (units)", metric: "3,420", product: "Pulse Resistance Bands", channel: "amazon", icon: "units" },
  { label: "Highest revenue", metric: "$52,850", product: "Drift Wireless Earbuds", channel: "ebay", icon: "revenue" },
  { label: "Highest net profit", metric: "$9,310", product: "Aurora Linen Throw", channel: "shopify", icon: "profit" },
  { label: "Best conversion", metric: "5.1%", product: "Lumen Desk Lamp", channel: "shopify", icon: "conversion" },
];

/** Integrations grid. `provider` keys match apps/web PROVIDER_META. */
export type IntegrationStatus = "connected" | "ready" | "soon";
export type Integration = {
  provider:
    | "shopify"
    | "amazon"
    | "ebay"
    | "meta_ads"
    | "google_ads"
    | "tiktok_ads"
    | "amazon_ads";
  label: string;
  status: IntegrationStatus;
};
export const SALES_CHANNELS: Integration[] = [
  { provider: "shopify", label: "Shopify", status: "connected" },
  { provider: "amazon", label: "Amazon", status: "connected" },
  { provider: "ebay", label: "eBay", status: "ready" },
];
export const AD_PLATFORMS: Integration[] = [
  { provider: "meta_ads", label: "Meta Ads", status: "connected" },
  { provider: "google_ads", label: "Google Ads", status: "connected" },
  { provider: "tiktok_ads", label: "TikTok Ads", status: "ready" },
  { provider: "amazon_ads", label: "Amazon Ads", status: "ready" },
];

/** Pricing tiers (mirrors PLAN.md Faz 9: Basic/Pro, 14-day trial). */
export type Plan = {
  name: string;
  tagline: string;
  monthly: number;
  annual: number;
  highlighted: boolean;
  cta: string;
  features: string[];
};
export const PLANS: Plan[] = [
  {
    name: "Basic",
    tagline: "For a single store finding its footing.",
    monthly: 39,
    annual: 31,
    highlighted: false,
    cta: "Start free trial",
    features: [
      "1 store, up to 2 sales channels",
      "Real net-profit dashboard",
      "COGS, shipping & fee tracking",
      "Daily data sync",
      "Email support",
    ],
  },
  {
    name: "Pro",
    tagline: "For multi-channel brands scaling on ads.",
    monthly: 89,
    annual: 71,
    highlighted: true,
    cta: "Start free trial",
    features: [
      "Unlimited stores & channels",
      "Ad attribution (Meta, Google, TikTok)",
      "Product & campaign profitability",
      "Custom metrics & widgets",
      "AI analysis via MCP",
      "Priority support",
    ],
  },
];

/** AI / MCP terminal transcript. */
export type ChatTurn =
  | { role: "user"; text: string }
  | { role: "tool"; name: string; args: string }
  | { role: "assistant"; text: string };
export const AI_TRANSCRIPT: ChatTurn[] = [
  {
    role: "user",
    text: "Which products lost money this month, and why?",
  },
  {
    role: "tool",
    name: "top_products_by_profit",
    args: '{ store: "all", range: "30d", order: "asc", limit: 5 }',
  },
  {
    role: "tool",
    name: "get_ad_performance",
    args: '{ store: "all", range: "30d", provider: "ebay_ads" }',
  },
  {
    role: "assistant",
    text: "1 product is unprofitable this month: **Drift Wireless Earbuds** at **−$2,260** net. It drives $52.8k revenue but ROAS is only **1.35×** — $19.4k of ad spend against thin margins after COGS and eBay fees. Cutting spend ~30% or raising price 8% would return it to profit.",
  },
];
