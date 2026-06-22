import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { storesApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth/store";
import { useStoreSelection } from "@/lib/stores/selection";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { CogsTab } from "./cogs-tab";
import { ShippingTab } from "./shipping-tab";
import { FeesTaxTab } from "./fees-tax-tab";
import { ExpensesTab } from "./expenses-tab";

export function CostsPage() {
  const role = useAuthStore((s) => s.activeOrg?.role);
  const canEdit = role === "owner" || role === "admin" || role === "analyst";

  const activeStoreId = useStoreSelection((s) => s.activeStoreId);
  const { data: stores = [], isLoading } = useQuery({
    queryKey: ["stores"],
    queryFn: storesApi.list,
  });
  const storeId = activeStoreId ?? stores[0]?.id ?? null;
  const storeName =
    stores.find((s) => s.id === storeId)?.name ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Maliyetler</h1>
        <p className="text-sm text-muted-foreground">
          COGS, kargo, ödeme ücreti, vergi ve özel giderler — net kâr motorunun
          girdileri.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : stores.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mağaza yok</CardTitle>
            <CardDescription>
              Maliyet kuralları mağazaya bağlıdır. Önce bir Shopify mağazası
              bağlayın.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/integrations">Entegrasyonlar</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="cogs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="cogs">COGS</TabsTrigger>
              <TabsTrigger value="shipping">Kargo</TabsTrigger>
              <TabsTrigger value="fees">Ödeme &amp; Vergi</TabsTrigger>
              <TabsTrigger value="expenses">Giderler</TabsTrigger>
            </TabsList>
            {storeName ? (
              <span className="text-sm text-muted-foreground">
                Mağaza: <span className="text-foreground">{storeName}</span>
              </span>
            ) : null}
          </div>

          {storeId ? (
            <>
              <TabsContent value="cogs">
                <CogsTab storeId={storeId} canEdit={canEdit} />
              </TabsContent>
              <TabsContent value="shipping">
                <ShippingTab storeId={storeId} canEdit={canEdit} />
              </TabsContent>
              <TabsContent value="fees">
                <FeesTaxTab storeId={storeId} canEdit={canEdit} />
              </TabsContent>
            </>
          ) : null}
          <TabsContent value="expenses">
            <ExpensesTab activeStoreId={storeId} canEdit={canEdit} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
