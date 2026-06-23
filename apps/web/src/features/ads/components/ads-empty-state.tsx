import { Card, CardContent } from "@/components/ui/card";

/** Mağaza/veri yokken gösterilen sayfa başlığı + bilgi kartı. */
export function AdsEmptyState({ text }: { text: string }) {
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
