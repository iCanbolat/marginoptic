import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { AreaChart, BarChart, LineChart } from "@/components/charts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Faz 5 doğrulama sayfası (iç): grafik primitive'lerini ve biçimlendiricileri örnek
 * veriyle gösterir. Faz 7 panosu bu bileşenleri gerçek `daily_store_metrics` ile besler.
 */

// Örnek 14 günlük seri (net kâr / ciro / reklam).
const SERIES = Array.from({ length: 14 }, (_, i) => {
  const date = `2026-06-${String(i + 1).padStart(2, "0")}`;
  const revenue = 800 + Math.round(Math.sin(i / 2) * 220) + i * 18;
  const adSpend = 120 + Math.round(Math.cos(i / 3) * 40);
  const netProfit = Math.round(revenue * 0.34) - adSpend;
  return { date, revenue, adSpend, netProfit };
});

const COST_BREAKDOWN = [
  { name: "COGS", value: 4200 },
  { name: "Kargo", value: 980 },
  { name: "Ödeme", value: 540 },
  { name: "Reklam", value: 1760 },
  { name: "Giderler", value: 720 },
];

const xDay = (v: string | number) => formatDate(String(v), { style: "short" });

export function ChartsPreviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Grafik & Biçimlendirme Önizleme
        </h1>
        <p className="text-sm text-muted-foreground">
          Faz 5 — yeniden kullanılabilir grafik primitive'leri ve para/yüzde/tarih
          biçimlendiricileri (örnek veri).
        </p>
      </div>

      {/* Biçimlendirici örnekleri */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Biçimlendiriciler</CardTitle>
          <CardDescription>çoklu para birimi · yerel: tr-TR</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Fmt label="USD" value={formatCurrency("1234567.5", "USD")} />
          <Fmt label="EUR (kısa)" value={formatCurrency(1234567.5, "EUR", { compact: true })} />
          <Fmt label="TRY" value={formatCurrency("89990.9", "TRY")} />
          <Fmt label="Yüzde" value={formatPercent(34.7)} />
          <Fmt label="Yüzde (işaretli)" value={formatPercent(12.4, { signed: true })} />
          <Fmt label="Sayı (kısa)" value={formatNumber(1825000, { compact: true })} />
          <Fmt label="Tarih" value={formatDate("2026-06-22", { style: "long" })} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Net Kâr Trendi</CardTitle>
            <CardDescription>çizgi · zaman serisi</CardDescription>
          </CardHeader>
          <CardContent>
            <LineChart
              data={SERIES}
              xKey="date"
              xFormatter={xDay}
              series={[{ key: "netProfit", label: "Net Kâr" }]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ciro & Reklam</CardTitle>
            <CardDescription>alan · çok serili</CardDescription>
          </CardHeader>
          <CardContent>
            <AreaChart
              data={SERIES}
              xKey="date"
              xFormatter={xDay}
              series={[
                { key: "revenue", label: "Ciro" },
                { key: "adSpend", label: "Reklam" },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Maliyet Kırılımı</CardTitle>
            <CardDescription>sütun · kategori</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              data={COST_BREAKDOWN}
              xKey="name"
              series={[{ key: "value", label: "Tutar" }]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Günlük Sipariş</CardTitle>
            <CardDescription>sütun · adet biçimi</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              data={SERIES.map((d, i) => ({ date: d.date, orders: 8 + (i % 5) * 3 }))}
              xKey="date"
              xFormatter={xDay}
              kind="number"
              series={[{ key: "orders", label: "Sipariş" }]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Fmt({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}
