import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AD_PROVIDERS,
  etsyConnectSchema,
  shopifyInstallSchema,
  type AdProvider,
  type ConnectionSummary,
  type EtsyConnectInput,
  type ProviderInfo,
  type ShopifyInstallInput,
  type StoreSummary,
} from "@churnify/shared";
import { ApiError, integrationsApi, storesApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function IntegrationsPage() {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.activeOrg?.role);
  const canManage = role === "owner" || role === "admin";

  const overviewQ = useQuery({
    queryKey: ["integrations"],
    queryFn: integrationsApi.overview,
  });

  // Gerçek OAuth dönüşünde ?connected=shopify
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      toast.success("Mağaza bağlandı");
      window.history.replaceState({}, "", window.location.pathname);
      void qc.invalidateQueries({ queryKey: ["integrations"] });
      void qc.invalidateQueries({ queryKey: ["stores"] });
    }
  }, [qc]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["integrations"] });
    void qc.invalidateQueries({ queryKey: ["stores"] });
  };

  const installMut = useMutation({
    mutationFn: (shop: string) => integrationsApi.shopifyInstall(shop),
    onSuccess: (res) => {
      window.location.href = res.url;
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Bağlantı başlatılamadı"),
  });

  const devConnectMut = useMutation({
    mutationFn: (shop: string) => integrationsApi.devConnect(shop),
    onSuccess: () => {
      toast.success("Mağaza bağlandı (dev)");
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Dev bağlantı başarısız"),
  });

  const disconnectMut = useMutation({
    mutationFn: (connectionId: string) =>
      integrationsApi.disconnect(connectionId),
    onSuccess: () => {
      toast.success("Bağlantı kaldırıldı");
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Kaldırma başarısız"),
  });

  const form = useForm<ShopifyInstallInput>({
    resolver: zodResolver(shopifyInstallSchema),
    defaultValues: { shop: "" },
  });

  const connectedProviders = new Set(
    (overviewQ.data?.connections ?? [])
      .filter((c) => c.status === "active")
      .map((c) => c.provider),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Entegrasyonlar</h1>
        <p className="text-sm text-muted-foreground">
          Satış kanallarını ve reklam hesaplarını bağla.
        </p>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shopify mağazası bağla</CardTitle>
            <CardDescription>
              .myshopify.com alan adını gir. OAuth onayı için Shopify'a
              yönlendirilirsin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit((v) => installMut.mutate(v.shop))}
              className="flex flex-col gap-3 sm:flex-row sm:items-start"
            >
              <div className="flex-1 space-y-1">
                <Input placeholder="magazam.myshopify.com" {...form.register("shop")} />
                {form.formState.errors.shop ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.shop.message}
                  </p>
                ) : null}
              </div>
              <Button type="submit" size="lg" disabled={installMut.isPending}>
                Bağla
              </Button>
              {import.meta.env.DEV ? (
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  disabled={devConnectMut.isPending}
                  onClick={() =>
                    form.handleSubmit((v) => devConnectMut.mutate(v.shop))()
                  }
                >
                  Dev bağla
                </Button>
              ) : null}
            </form>
          </CardContent>
        </Card>
      ) : null}

      {canManage &&
      (overviewQ.data?.providers ?? []).some(
        (p) => p.provider === "etsy" && p.connectable,
      ) ? (
        <EtsyConnectCard onDone={invalidate} />
      ) : null}

      {canManage ? (
        <AdConnectCard
          providers={(overviewQ.data?.providers ?? []).filter(
            (p) => p.kind === "ads" && p.connectable,
          )}
          onDone={invalidate}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {overviewQ.data?.providers.map((p) => (
          <ProviderCard
            key={p.provider}
            info={p}
            connected={connectedProviders.has(p.provider)}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bağlantılar</CardTitle>
        </CardHeader>
        <CardContent>
          {overviewQ.isLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : overviewQ.data && overviewQ.data.connections.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sağlayıcı</TableHead>
                  <TableHead>Hesap</TableHead>
                  <TableHead>Durum</TableHead>
                  {canManage ? (
                    <TableHead className="text-right">İşlem</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {overviewQ.data.connections.map((c) => (
                  <ConnectionRow
                    key={c.id}
                    conn={c}
                    canManage={canManage}
                    onDisconnect={() => disconnectMut.mutate(c.id)}
                    disconnecting={disconnectMut.isPending}
                  />
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Henüz bağlantı yok.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EtsyConnectCard({ onDone }: { onDone: () => void }) {
  const form = useForm<EtsyConnectInput>({
    resolver: zodResolver(etsyConnectSchema),
    defaultValues: { shop: "" },
  });

  const installMut = useMutation({
    mutationFn: () => integrationsApi.etsyInstall(),
    onSuccess: (res) => {
      window.location.href = res.url;
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Etsy bağlantısı başlatılamadı"),
  });

  const devMut = useMutation({
    mutationFn: (shop: string) => integrationsApi.etsyDevConnect(shop),
    onSuccess: () => {
      toast.success("Etsy mağazası bağlandı (dev)");
      onDone();
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Dev bağlantı başarısız"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Etsy mağazası bağla</CardTitle>
        <CardDescription>
          Etsy OAuth onayı için yönlendirilirsin (PKCE). Mağaza adın bağlantı
          sonrası otomatik çözülür.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit(() => installMut.mutate())}
          className="flex flex-col gap-3 sm:flex-row sm:items-start"
        >
          <Button type="submit" size="lg" disabled={installMut.isPending}>
            Etsy ile bağla
          </Button>
          {import.meta.env.DEV ? (
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-start">
              <div className="flex-1 space-y-1">
                <Input
                  placeholder="dev: etsy mağaza adı"
                  aria-label="Etsy mağaza adı (dev)"
                  {...form.register("shop")}
                />
                {form.formState.errors.shop ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.shop.message}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                size="lg"
                variant="outline"
                disabled={devMut.isPending}
                onClick={() =>
                  form.handleSubmit((v) => devMut.mutate(v.shop))()
                }
              >
                Dev bağla
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

const AD_LABELS: Record<AdProvider, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  tiktok_ads: "TikTok Ads",
};

function AdConnectCard({
  providers,
  onDone,
}: {
  providers: ProviderInfo[];
  onDone: () => void;
}) {
  const { data: stores = [] } = useQuery({
    queryKey: ["stores"],
    queryFn: storesApi.list,
  });
  const adProviders = providers
    .map((p) => p.provider)
    .filter((p): p is AdProvider =>
      (AD_PROVIDERS as readonly string[]).includes(p),
    );

  const [provider, setProvider] = useState<AdProvider | "">("");
  const [storeId, setStoreId] = useState("");
  const [account, setAccount] = useState("");

  const installMut = useMutation({
    mutationFn: () => integrationsApi.adInstall(provider as AdProvider, storeId),
    onSuccess: (res) => {
      window.location.href = res.url;
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Bağlantı başlatılamadı"),
  });

  const devMut = useMutation({
    mutationFn: () =>
      integrationsApi.adDevConnect(provider as AdProvider, {
        storeId,
        externalAccountId: account || "act_demo",
      }),
    onSuccess: () => {
      toast.success("Reklam hesabı bağlandı (dev)");
      onDone();
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Dev bağlantı başarısız"),
  });

  const ready = provider !== "" && storeId !== "";

  if (adProviders.length === 0 || stores.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reklam hesabı bağla</CardTitle>
        <CardDescription>
          Sağlayıcı ve harcamanın atfedileceği mağazayı seç. OAuth onayı için
          sağlayıcıya yönlendirilirsin.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
        <div className="space-y-1">
          <span className="block text-xs text-muted-foreground">Sağlayıcı</span>
          <Select value={provider} onValueChange={(v) => setProvider(v as AdProvider)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Seç" />
            </SelectTrigger>
            <SelectContent>
              {adProviders.map((p) => (
                <SelectItem key={p} value={p}>
                  {AD_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="block text-xs text-muted-foreground">Mağaza</span>
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Mağaza seç" />
            </SelectTrigger>
            <SelectContent>
              {stores.map((s: StoreSummary) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1">
          <span className="block text-xs text-muted-foreground">Hesap kimliği</span>
          <Input
            placeholder="act_123456789"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          />
        </div>
        <Button
          type="button"
          disabled={!ready || installMut.isPending}
          onClick={() => installMut.mutate()}
        >
          Bağla
        </Button>
        {import.meta.env.DEV ? (
          <Button
            type="button"
            variant="outline"
            disabled={!ready || devMut.isPending}
            onClick={() => devMut.mutate()}
          >
            Dev bağla
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ProviderCard({
  info,
  connected,
}: {
  info: ProviderInfo;
  connected: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{info.label}</CardTitle>
          <Badge variant="outline" className="capitalize">
            {info.kind === "channel" ? "Kanal" : "Reklam"}
          </Badge>
        </div>
        <CardDescription>
          {connected ? (
            <span className="text-foreground">Bağlı</span>
          ) : info.connectable ? (
            "Bağlanmaya hazır"
          ) : (
            "Yakında"
          )}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function ConnectionRow({
  conn,
  canManage,
  onDisconnect,
  disconnecting,
}: {
  conn: ConnectionSummary;
  canManage: boolean;
  onDisconnect: () => void;
  disconnecting: boolean;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium capitalize">
        {conn.provider.replace("_", " ")}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {conn.externalAccountId ?? "—"}
      </TableCell>
      <TableCell>
        <Badge
          variant={conn.status === "active" ? "secondary" : "outline"}
          className="capitalize"
        >
          {conn.status}
        </Badge>
      </TableCell>
      {canManage ? (
        <TableCell className="text-right">
          {conn.status !== "disconnected" ? (
            <Button
              variant="destructive"
              size="sm"
              disabled={disconnecting}
              onClick={onDisconnect}
            >
              Kaldır
            </Button>
          ) : null}
        </TableCell>
      ) : null}
    </TableRow>
  );
}
