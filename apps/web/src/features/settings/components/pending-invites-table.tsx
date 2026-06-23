import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InvitationView } from "../types/member-types";

/** Bekleyen davetler kartı (boşsa hiç render edilmez). */
export function PendingInvitesTable({
  invitations,
}: {
  invitations: InvitationView[];
}) {
  if (invitations.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bekleyen davetler</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-posta</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Bitiş</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell>{inv.email}</TableCell>
                <TableCell className="capitalize">{inv.role}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(inv.expiresAt).toLocaleDateString("tr-TR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
