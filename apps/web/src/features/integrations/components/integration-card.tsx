import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PROVIDER_META, type ProviderInfo } from "../types/integration-types";

interface IntegrationCardProps {
  info: ProviderInfo;
  connected: boolean;
  canManage: boolean;
  onConnect: () => void;
}

export function IntegrationCard({
  info,
  connected,
  canManage,
  onConnect,
}: IntegrationCardProps) {
  const meta = PROVIDER_META[info.provider];

  const statusText = connected
    ? "Hesap bağlı"
    : info.connectable
      ? "Bağlanmaya hazır"
      : "Yakında";

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex size-10 items-center justify-center bg-muted ring-1 ring-foreground/10">
            <HugeiconsIcon icon={meta.icon} className="size-5" strokeWidth={1.8} />
          </div>
          {connected ? (
            <Badge
              variant="secondary"
              className="gap-1 text-emerald-600 dark:text-emerald-400"
            >
              <HugeiconsIcon icon={CheckmarkCircle02Icon} />
              Bağlı
            </Badge>
          ) : null}
        </div>
        <CardTitle className="mt-3">{meta.label}</CardTitle>
        <CardDescription>{statusText}</CardDescription>
      </CardHeader>

      {canManage ? (
        <CardContent className="mt-auto">
          {!info.connectable ? (
            <Button variant="outline" size="sm" className="w-full" disabled>
              Yakında
            </Button>
          ) : connected ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onConnect}
            >
              Yeniden bağla
            </Button>
          ) : (
            <Button size="sm" className="w-full" onClick={onConnect}>
              Bağla
            </Button>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
