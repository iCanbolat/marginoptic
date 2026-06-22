import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  inviteMemberSchema,
  type InviteMemberInput,
  type Role,
} from "@churnify/shared";
import { ApiError, orgApi } from "@/lib/api";
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

const ASSIGNABLE: Exclude<Role, "owner">[] = ["admin", "analyst", "viewer"];

export function MembersPage() {
  const qc = useQueryClient();
  const activeOrg = useAuthStore((s) => s.activeOrg);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const canManage = activeOrg?.role === "owner" || activeOrg?.role === "admin";

  const membersQ = useQuery({ queryKey: ["members"], queryFn: orgApi.members });
  const invitesQ = useQuery({
    queryKey: ["invitations"],
    queryFn: orgApi.invitations,
    enabled: !!canManage,
  });

  const inviteForm = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "", role: "viewer" },
  });

  const inviteMut = useMutation({
    mutationFn: (input: InviteMemberInput) => orgApi.invite(input),
    onSuccess: (res) => {
      toast.success(`Davet oluşturuldu: ${res.email}`);
      inviteForm.reset({ email: "", role: "viewer" });
      void qc.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Davet başarısız"),
  });

  const roleMut = useMutation({
    mutationFn: (v: { userId: string; role: Exclude<Role, "owner"> }) =>
      orgApi.updateRole(v.userId, v.role),
    onSuccess: () => {
      toast.success("Rol güncellendi");
      void qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Güncelleme başarısız"),
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) => orgApi.removeMember(userId),
    onSuccess: () => {
      toast.success("Üye kaldırıldı");
      void qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : "Kaldırma başarısız"),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Üyeler</h1>
        <p className="text-sm text-muted-foreground">
          {activeOrg?.name} organizasyonundaki ekip.
        </p>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Üye davet et</CardTitle>
            <CardDescription>
              E-posta ile davet oluştur; davet linki üretilir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={inviteForm.handleSubmit((v) => inviteMut.mutate(v))}
              className="flex flex-col gap-3 sm:flex-row sm:items-start"
            >
              <div className="flex-1 space-y-1">
                <Input
                  type="email"
                  placeholder="ad@ornek.com"
                  {...inviteForm.register("email")}
                />
                {inviteForm.formState.errors.email ? (
                  <p className="text-xs text-destructive">
                    {inviteForm.formState.errors.email.message}
                  </p>
                ) : null}
              </div>
              <Controller
                control={inviteForm.control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full sm:w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE.map((r) => (
                        <SelectItem key={r} value={r} className="capitalize">
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Button type="submit" size="lg" disabled={inviteMut.isPending}>
                Davet et
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ekip</CardTitle>
        </CardHeader>
        <CardContent>
          {membersQ.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
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
                {membersQ.data?.map((m) => {
                  const isOwner = m.role === "owner";
                  const isSelf = m.userId === currentUserId;
                  return (
                    <TableRow key={m.userId}>
                      <TableCell>
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {m.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        {canManage && !isOwner ? (
                          <Select
                            value={m.role}
                            onValueChange={(role) =>
                              roleMut.mutate({
                                userId: m.userId,
                                role: role as Exclude<Role, "owner">,
                              })
                            }
                          >
                            <SelectTrigger size="sm" className="w-32 capitalize">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ASSIGNABLE.map((r) => (
                                <SelectItem
                                  key={r}
                                  value={r}
                                  className="capitalize"
                                >
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
                              disabled={removeMut.isPending}
                              onClick={() => removeMut.mutate(m.userId)}
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
          )}
        </CardContent>
      </Card>

      {canManage && invitesQ.data && invitesQ.data.length > 0 ? (
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
                {invitesQ.data.map((inv) => (
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
      ) : null}
    </div>
  );
}
