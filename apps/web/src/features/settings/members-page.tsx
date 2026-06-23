import { useAuthStore } from "@/lib/auth/store";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMembers } from "./hooks/use-members";
import { useInvitations } from "./hooks/use-invitations";
import { InviteMemberDialog } from "./components/invite-member-dialog";
import { MembersTable } from "./components/members-table";
import { PendingInvitesTable } from "./components/pending-invites-table";

export function MembersPage() {
  const activeOrg = useAuthStore((s) => s.activeOrg);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const canManage = activeOrg?.role === "owner" || activeOrg?.role === "admin";

  const { membersQ, updateRole, remove } = useMembers();
  const { invitesQ, invite } = useInvitations(!!canManage);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Üyeler</h1>
          <p className="text-sm text-muted-foreground">
            {activeOrg?.name} organizasyonundaki ekip.
          </p>
        </div>
        {canManage ? (
          <InviteMemberDialog
            pending={invite.isPending}
            onInvite={(v) => invite.mutateAsync(v)}
          />
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ekip</CardTitle>
        </CardHeader>
        <CardContent>
          <MembersTable
            members={membersQ.data}
            isLoading={membersQ.isLoading}
            canManage={!!canManage}
            currentUserId={currentUserId}
            rolePending={updateRole.isPending}
            removePending={remove.isPending}
            onRoleChange={(userId, role) => updateRole.mutate({ userId, role })}
            onRemove={(userId) => remove.mutate(userId)}
          />
        </CardContent>
      </Card>

      {canManage && invitesQ.data ? (
        <PendingInvitesTable invitations={invitesQ.data} />
      ) : null}
    </div>
  );
}
