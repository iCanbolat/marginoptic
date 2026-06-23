import { formatCurrency, formatNumber } from "@/lib/format";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LEVEL_LABEL, type AdLevel, type AdPerformanceRow } from "../types/ad-types";
import { ratio } from "../utils/ads-format";

interface AdsBreakdownTableProps {
  level: AdLevel;
  rows: AdPerformanceRow[];
}

/** Seçili kırılım seviyesi için reklam varlığı performans tablosu. */
export function AdsBreakdownTable({ level, rows }: AdsBreakdownTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{LEVEL_LABEL[level]} Kırılımı</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length > 0 ? (
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
              {rows.map((r) => (
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
  );
}
