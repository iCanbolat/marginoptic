import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function OrdersEmptyState() {
  return (
    <div className="mx-auto max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle>Mağaza yok</CardTitle>
          <CardDescription>
            Sipariş verisi görmek için önce bir Shopify mağazası bağlayın.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/integrations">Entegrasyonlar</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
