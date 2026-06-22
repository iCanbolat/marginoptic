import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  Copy01Icon,
  Delete02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import {
  MCP_SCOPES,
  MCP_SCOPE_DESCRIPTIONS,
  type ApiKeyCreatedResponse,
  type McpScope,
} from "@churnify/shared";
import { ApiError, MCP_ENDPOINT, apiKeysApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth/store";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

async function copy(text: string, label = "Panoya kopyalandı"): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Kopyalanamadı");
  }
}

/** Claude Desktop / istemci için MCP sunucu yapılandırması (JSON). */
function clientConfig(key: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        churnify: {
          type: "http",
          url: MCP_ENDPOINT,
          headers: { Authorization: `Bearer ${key}` },
        },
      },
    },
    null,
    2,
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="shrink-0 text-muted-foreground"
      onClick={() => void copy(text, label)}
      aria-label="Kopyala"
    >
      <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} className="size-4" />
    </Button>
  );
}

export function ApiKeysPage() {
  const qc = useQueryClient();
  const activeOrg = useAuthStore((s) => s.activeOrg);
  const canManage = activeOrg?.role === "owner" || activeOrg?.role === "admin";

  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<McpScope[]>([...MCP_SCOPES]);
  const [created, setCreated] = useState<ApiKeyCreatedResponse | null>(null);

  const keysQ = useQuery({
    queryKey: ["api-keys"],
    queryFn: apiKeysApi.list,
    enabled: canManage,
  });

  const createMut = useMutation({
    mutationFn: () => apiKeysApi.create({ name: name.trim(), scopes }),
    onSuccess: (res) => {
      setCreated(res);
      setName("");
      setScopes([...MCP_SCOPES]);
      void qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Oluşturulamadı"),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => apiKeysApi.revoke(id),
    onSuccess: () => {
      toast.success("API anahtarı iptal edildi");
      void qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "İptal edilemedi"),
  });

  const toggleScope = (s: McpScope) =>
    setScopes((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
    );

  if (!canManage) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            API Anahtarları
          </h1>
          <p className="text-sm text-muted-foreground">
            MCP üzerinden AI istemcileri için erişim anahtarları.
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            API anahtarlarını yönetmek için owner veya admin rolü gerekir.
          </CardContent>
        </Card>
      </div>
    );
  }

  const keys = keysQ.data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          API Anahtarları
        </h1>
        <p className="text-sm text-muted-foreground">
          Claude / ChatGPT gibi MCP istemcilerinin {activeOrg?.name} verilerine
          salt-okunur erişimi için anahtar üret.
        </p>
      </div>

      {/* Oluşturma */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Yeni anahtar</CardTitle>
          <CardDescription>
            Bir ad ver ve erişim kapsamlarını seç. Ham anahtar yalnız bir kez
            gösterilir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createMut.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="key-name">Ad</Label>
              <Input
                id="key-name"
                value={name}
                required
                placeholder="Örn. Claude Desktop"
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Kapsamlar</Label>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {MCP_SCOPES.map((s) => {
                  const checked = scopes.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleScope(s)}
                      className={cn(
                        "flex items-start gap-2 rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                        checked && "border-primary/40 bg-primary/5",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input",
                        )}
                      >
                        {checked && (
                          <HugeiconsIcon
                            icon={Tick02Icon}
                            strokeWidth={2.5}
                            className="size-3"
                          />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-mono text-xs font-medium">
                          {s}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {MCP_SCOPE_DESCRIPTIONS[s]}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={
                createMut.isPending || name.trim() === "" || scopes.length === 0
              }
            >
              {createMut.isPending ? "Oluşturuluyor…" : "Anahtar oluştur"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Liste */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Anahtarlar</CardTitle>
        </CardHeader>
        <CardContent>
          {keysQ.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : keys.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Henüz API anahtarı yok.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad</TableHead>
                  <TableHead>Kapsamlar</TableHead>
                  <TableHead>Son kullanım</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => {
                  const revoked = k.revokedAt != null;
                  return (
                    <TableRow key={k.id} className={cn(revoked && "opacity-50")}>
                      <TableCell>
                        <div className="font-medium">{k.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {k.keyPrefix}…
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {k.scopes.map((s) => (
                            <Badge
                              key={s}
                              variant="secondary"
                              className="font-mono text-[10px]"
                            >
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {k.lastUsedAt
                          ? new Date(k.lastUsedAt).toLocaleString("tr-TR")
                          : "Hiç"}
                      </TableCell>
                      <TableCell className="text-right">
                        {revoked ? (
                          <Badge variant="outline">İptal edildi</Badge>
                        ) : (
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={revokeMut.isPending}
                            onClick={() => revokeMut.mutate(k.id)}
                          >
                            İptal et
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Bağlanma talimatı */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">MCP istemcisine bağlanma</CardTitle>
          <CardDescription>
            Anahtarı oluşturduktan sonra istemcini bu uca yönlendir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-1.5">
            <Label>Sunucu URL'i</Label>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-xs">
                {MCP_ENDPOINT}
              </code>
              <CopyButton text={MCP_ENDPOINT} label="URL kopyalandı" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Claude Desktop yapılandırması</Label>
            <div className="relative rounded-md border border-border bg-muted/40">
              <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
                {clientConfig("<API_ANAHTARINIZ>")}
              </pre>
              <div className="absolute right-1.5 top-1.5">
                <CopyButton
                  text={clientConfig("<API_ANAHTARINIZ>")}
                  label="Yapılandırma kopyalandı"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              <code>&lt;API_ANAHTARINIZ&gt;</code> yerine oluşturduğun anahtarı
              yaz. MCP Inspector için:{" "}
              <code className="font-mono">
                npx @modelcontextprotocol/inspector
              </code>{" "}
              → Transport “Streamable HTTP” → yukarıdaki URL +{" "}
              <code className="font-mono">Authorization: Bearer …</code> header.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Oluşturulan anahtar (bir kez gösterilir) */}
      <Dialog
        open={created != null}
        onOpenChange={(o) => {
          if (!o) setCreated(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>API anahtarın hazır</DialogTitle>
            <DialogDescription>
              Bu anahtar bir daha gösterilmeyecek — şimdi güvenli bir yere
              kaydet.
            </DialogDescription>
          </DialogHeader>

          {created && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <HugeiconsIcon
                  icon={Alert02Icon}
                  strokeWidth={2}
                  className="mt-0.5 size-4 shrink-0"
                />
                <span>
                  Anahtar org genelinde salt-okunur analytics erişimi verir.
                  Sızdırırsan bu sayfadan iptal et.
                </span>
              </div>

              <div className="space-y-1.5">
                <Label>Anahtar</Label>
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
                  <code className="min-w-0 flex-1 break-all font-mono text-xs">
                    {created.key}
                  </code>
                  <CopyButton text={created.key} label="Anahtar kopyalandı" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Claude Desktop yapılandırması</Label>
                <div className="relative rounded-md border border-border bg-muted/40">
                  <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
                    {clientConfig(created.key)}
                  </pre>
                  <div className="absolute right-1.5 top-1.5">
                    <CopyButton
                      text={clientConfig(created.key)}
                      label="Yapılandırma kopyalandı"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setCreated(null)}>Kaydettim, kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
