import type { AdProvider } from "@churnify/shared";
import type { AnalyticsFilterParams } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart } from "@/components/charts";
import { useAdsPerformance } from "../use-analytics";

const CHANNEL_LABEL: Record<AdProvider, string> = {
  meta_ads: "Meta",
  google_ads: "Google",
  tiktok_ads: "TikTok",
};

export function ChannelWidget({ filter }: { filter: AnalyticsFilterParams }) {
  const q = useAdsPerformance(filter, "campaign");
  if (q.isLoading) return <Skeleton className="h-full min-h-40 w-full" />;
  if (!q.data || q.data.rows.length === 0)
    return (
      <p className="grid h-full place-items-center text-sm text-muted-foreground">
        Reklam kanalı verisi yok.
      </p>
    );

  const byProvider = new Map<string, { spend: number; conversionValue: number }>();
  for (const r of q.data.rows) {
    const cur = byProvider.get(r.provider) ?? { spend: 0, conversionValue: 0 };
    cur.spend += Number(r.spend);
    cur.conversionValue += Number(r.conversionValue);
    byProvider.set(r.provider, cur);
  }

  const data = [...byProvider.entries()].map(([provider, v]) => ({
    channel: CHANNEL_LABEL[provider as AdProvider] ?? provider,
    spend: v.spend,
    conversionValue: v.conversionValue,
  }));

  return (
    <BarChart
      data={data}
      xKey="channel"
      currency={q.data.currency}
      height={240}
      series={[
        { key: "spend", label: "Harcama" },
        { key: "conversionValue", label: "Dönüşüm Değeri" },
      ]}
    />
  );
}
