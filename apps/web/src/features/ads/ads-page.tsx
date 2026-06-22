import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AD_LEVELS, type AdLevel, type AdsSummary } from "@churnify/shared";
import { adsApi, storesApi } from "@/lib/api";
import { useStoreSelection } from "@/lib/stores/selection";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { AreaChart } from "@/components/charts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const LEVEL_LABEL: Record<AdLevel, string> = {
  account: "Hesap",
  campaign: "Kampanya",
  adset: "Adset",
  ad: "Reklam",
};

function ratio(n: number | null): string {
  return n == null ? "—" : `${n.toFixed(2)}×`;
}

export function AdsPage() {
  const qc = useQueryClient();
  const activeStoreId = useStoreSelection((s) => s.activeStoreId);
  const { data: stores = [] } = useQuery({
    queryKey: ["stores"],
    queryFn: storesApi.list,
  });
  const storeId = activeStoreId ?? stores[0]?.id ?? null;
  const currency = stores.find((s) => s.id === storeId)?.currency ?? "USD";

  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState("2025-01-01");
  const [to, setTo] = useState(today);
  const [level, setLevel] = useState<AdLevel>("campaign");

  // Reklam OAuth dönüşünde ?connected=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      toast.success("Reklam hesabı bağlandı");
      window.history.replaceState({}, "", window.location.pathname);
      void qc.invalidateQueries({ queryKey: ["ads-performance"] });
    }
  }, [qc]);

  const perfQ = useQuery({
    queryKey: ["ads-performance", storeId, from, to, level],
    queryFn: () => adsApi.performance(storeId as string, { from, to, level }),
    enabled: storeId != null,
  });

  if (!storeId) {
    return (
      <EmptyState text="Reklam performansı için önce bir mağaza bağla (Entegrasyonlar)." />
    );
  }

  const data = perfQ.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reklamlar</h1>
          <p className="text-sm text-muted-foreground">
            Reklam harcaması, ROAS ve POAS (reklama göre net kâr).
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <DateField label="Başlangıç" value={from} onChange={setFrom} />
          <DateField label="Bitiş" value={to} onChange={setTo} />
          <div className="space-y-1">
            <span className="block text-xs text-muted-foreground">Kırılım</span>
            <Select value={level} onValueChange={(v) => setLevel(v as AdLevel)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AD_LEVELS.filter((l) => l !== "account").map((l) => (
                  <SelectItem key={l} value={l}>
                    {LEVEL_LABEL[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {perfQ.isLoading ? (
        <Skeleton className="h-28 w-full" />
      ) : data ? (
        <>
          <SummaryCards summary={data.summary} currency={currency} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Günlük Reklam Harcaması</CardTitle>
              <CardDescription>harcama vs. dönüşüm değeri</CardDescription>
            </CardHeader>
            <CardContent>
              {data.daily.length > 0 ? (
                <AreaChart
                  data={data.daily.map((d) => ({
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {LEVEL_LABEL[level]} Kırılımı
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.rows.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{LEVEL_LABEL[level]}</TableHead>
                      <TableHead className="text-right">Harcama</TableHead>
                      <TableHead className="text-right">Gösterim</TableHead>
                      <TableHead className="text-right">Tıklama</TableHead>
                      <TableHead className="text-right">Dönüşüm</TableHead>
                      <TableHead className="text-right">Gelir</TableHead>
                      <TableHead className="text-right">ROAS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((r) => (
                      <TableRow key={`${r.provider}-${r.entityExternalId}`}>
                        <TableCell className="font-medium">
                          {r.name ?? r.entityExternalId}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(r.spend, r.currency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(r.impressions)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(r.clicks)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(r.conversions)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(r.conversionValue, r.currency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {ratio(r.roas)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Bağlı reklam hesabı/verisi yok. Entegrasyonlar'dan bağla.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState text="Reklam verisi yüklenemedi." />
      )}
    </div>
  );
}

function SummaryCards({
  summary,
  currency,
}: {
  summary: AdsSummary;
  currency: string;
}) {
  const cards = [
    { title: "Reklam Harcaması", value: formatCurrency(summary.spend, currency) },
    { title: "Dönüşüm Değeri", value: formatCurrency(summary.conversionValue, currency) },
    { title: "ROAS (blended)", value: ratio(summary.blendedRoas), hint: "ciro / harcama" },
    { title: "POAS", value: ratio(summary.poas), hint: "net kâr / harcama" },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.title}>
          <CardHeader>
            <CardDescription>{c.title}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{c.value}</CardTitle>
            {c.hint ? (
              <CardDescription className="text-xs">{c.hint}</CardDescription>
            ) : null}
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-40"
      />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reklamlar</h1>
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {text}
        </CardContent>
      </Card>
    </div>
  );
}
