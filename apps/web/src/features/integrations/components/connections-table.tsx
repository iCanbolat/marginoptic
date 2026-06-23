import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PROVIDER_META,
  type ConnectionSummary,
} from "../types/integration-types";

interface ConnectionsTableProps {
  connections: ConnectionSummary[];
  isLoading: boolean;
  canManage: boolean;
  onDisconnect: (connectionId: string) => void;
  disconnecting: boolean;
}

export function ConnectionsTable({
  connections,
  isLoading,
  canManage,
  onDisconnect,
  disconnecting,
}: ConnectionsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bağlantılar</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : connections.length > 0 ? (
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
              {connections.map((conn) => (
                <ConnectionRow
                  key={conn.id}
                  conn={conn}
                  canManage={canManage}
                  onDisconnect={() => onDisconnect(conn.id)}
                  disconnecting={disconnecting}
                />
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">Henüz bağlantı yok.</p>
        )}
      </CardContent>
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
      <TableCell className="font-medium">
        {PROVIDER_META[conn.provider]?.label ?? conn.provider}
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
