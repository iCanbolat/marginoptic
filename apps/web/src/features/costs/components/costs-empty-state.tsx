import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Hiç mağaza bağlı değilken gösterilen bilgi kartı. */
export function CostsEmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mağaza yok</CardTitle>
        <CardDescription>
          Maliyet kuralları mağazaya bağlıdır. Önce bir Shopify mağazası bağlayın.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link to="/integrations">Entegrasyonlar</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
