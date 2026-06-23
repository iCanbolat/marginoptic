import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth/store";
import { Skeleton } from "@/components/ui/skeleton";
import { IntegrationCard } from "./components/integration-card";
import { ConnectionsTable } from "./components/connections-table";
import { ConnectShopifyDialog } from "./components/connect-shopify-dialog";
import { ConnectEtsyDialog } from "./components/connect-etsy-dialog";
import { ConnectAdsDialog } from "./components/connect-ads-dialog";
import { useIntegrationsOverview } from "./hooks/use-integrations-overview";
import { useDisconnect } from "./hooks/use-disconnect";
import { integrationKeys } from "./hooks/integration-keys";
import type {
  AdProvider,
  IntegrationProvider,
  ProviderInfo,
} from "./types/integration-types";

export function IntegrationsPage() {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.activeOrg?.role);
  const canManage = role === "owner" || role === "admin";

  const overviewQ = useIntegrationsOverview();
  const disconnect = useDisconnect();

  // Açık connect dialog'ları (her biri lokal UI durumu).
  const [shopifyOpen, setShopifyOpen] = useState(false);
  const [etsyOpen, setEtsyOpen] = useState(false);
  const [adsProvider, setAdsProvider] = useState<AdProvider | null>(null);

  // Gerçek OAuth dönüşünde ?connected=<provider>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      toast.success("Mağaza bağlandı");
      window.history.replaceState({}, "", window.location.pathname);
      void qc.invalidateQueries({ queryKey: integrationKeys.overview() });
      void qc.invalidateQueries({ queryKey: integrationKeys.stores() });
    }
  }, [qc]);

  const providers = overviewQ.data?.providers ?? [];
  const connections = overviewQ.data?.connections ?? [];
  const connectedProviders = new Set(
    connections.filter((c) => c.status === "active").map((c) => c.provider),
  );

  const channels = providers.filter((p) => p.kind === "channel");
  const adPlatforms = providers.filter((p) => p.kind === "ads");

  function handleConnect(provider: IntegrationProvider) {
    if (provider === "shopify") setShopifyOpen(true);
    else if (provider === "etsy") setEtsyOpen(true);
    else setAdsProvider(provider as AdProvider);
  }

  function renderSection(title: string, list: ProviderInfo[]) {
    if (overviewQ.isLoading) {
      return (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-36 w-full" />
          </div>
        </section>
      );
    }
    if (list.length === 0) return null;
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <IntegrationCard
              key={p.provider}
              info={p}
              connected={connectedProviders.has(p.provider)}
              canManage={canManage}
              onConnect={() => handleConnect(p.provider)}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Entegrasyonlar</h1>
        <p className="text-sm text-muted-foreground">
          Satış kanallarını ve reklam hesaplarını bağla.
        </p>
      </div>

      {renderSection("Satış Kanalları", channels)}
      {renderSection("Reklam Platformları", adPlatforms)}

      <ConnectionsTable
        connections={connections}
        isLoading={overviewQ.isLoading}
        canManage={canManage}
        onDisconnect={(id) => disconnect.mutate(id)}
        disconnecting={disconnect.isPending}
      />

      {canManage ? (
        <>
          <ConnectShopifyDialog
            open={shopifyOpen}
            onOpenChange={setShopifyOpen}
          />
          <ConnectEtsyDialog open={etsyOpen} onOpenChange={setEtsyOpen} />
          <ConnectAdsDialog
            provider={adsProvider}
            onOpenChange={(open) => {
              if (!open) setAdsProvider(null);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
