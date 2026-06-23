import { formatCurrency } from "@/lib/format";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AdsSummary } from "../types/ad-types";
import { ratio } from "../utils/ads-format";

interface AdsSummaryCardsProps {
  summary: AdsSummary;
  currency: string;
}

/** Reklam harcaması, dönüşüm değeri, blended ROAS ve POAS özet kartları. */
export function AdsSummaryCards({ summary, currency }: AdsSummaryCardsProps) {
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
