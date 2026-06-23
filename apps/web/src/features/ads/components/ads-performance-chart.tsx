import { formatDate } from "@/lib/format";
import { AreaChart } from "@/components/charts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AdDailyPoint } from "../types/ad-types";

interface AdsPerformanceChartProps {
  daily: AdDailyPoint[];
  currency: string;
}

/** Günlük reklam harcaması vs. dönüşüm değeri alan grafiği. */
export function AdsPerformanceChart({ daily, currency }: AdsPerformanceChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Günlük Reklam Harcaması</CardTitle>
        <CardDescription>harcama vs. dönüşüm değeri</CardDescription>
      </CardHeader>
      <CardContent>
        {daily.length > 0 ? (
          <AreaChart
            data={daily.map((d) => ({
              date: d.date,
              spend: Number(d.spend),
              conversionValue: Number(d.conversionValue),
            }))}
            xKey="date"
            xFormatter={(v) => formatDate(String(v), { style: "short" })}
            currency={currency}
            series={[
              { key: "spend", label: "Harcama" },
              { key: "conversionValue", label: "Dönüşüm Değeri" },
            ]}
          />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Bu aralıkta reklam verisi yok.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
