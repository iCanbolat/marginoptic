import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ASSIGNABLE_ROLES,
  type MemberView,
  type Role,
} from "../types/member-types";

interface MembersTableProps {
  members: MemberView[] | undefined;
  isLoading: boolean;
  canManage: boolean;
  currentUserId: string | undefined;
  rolePending: boolean;
  removePending: boolean;
  onRoleChange: (userId: string, role: Exclude<Role, "owner">) => void;
  onRemove: (userId: string) => void;
}

export function MembersTable({
  members,
  isLoading,
  canManage,
  currentUserId,
  rolePending,
  removePending,
  onRoleChange,
  onRemove,
}: MembersTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Üye</TableHead>
          <TableHead>Rol</TableHead>
          {canManage ? (
            <TableHead className="text-right">İşlem</TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {members?.map((m) => {
          const isOwner = m.role === "owner";
          const isSelf = m.userId === currentUserId;
          return (
            <TableRow key={m.userId}>
              <TableCell>
                <div className="font-medium">{m.name}</div>
                <div className="text-xs text-muted-foreground">{m.email}</div>
              </TableCell>
              <TableCell>
                {canManage && !isOwner ? (
                  <Select
                    value={m.role}
                    disabled={rolePending}
                    onValueChange={(role) =>
                      onRoleChange(m.userId, role as Exclude<Role, "owner">)
                    }
                  >
                    <SelectTrigger size="sm" className="w-32 capitalize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map((r) => (
                        <SelectItem key={r} value={r} className="capitalize">
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary" className="capitalize">
                    {m.role}
                  </Badge>
                )}
              </TableCell>
              {canManage ? (
                <TableCell className="text-right">
                  {!isOwner && !isSelf ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={removePending}
                      onClick={() => onRemove(m.userId)}
                    >
                      Kaldır
                    </Button>
                  ) : null}
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
