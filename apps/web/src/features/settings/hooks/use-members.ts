import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { membersApi } from "../api/members-api";
import { memberKeys } from "./member-keys";
import { errMsg } from "../utils/errors";
import type { Role } from "../types/member-types";

/** Ekip üyeleri: liste sorgusu + rol güncelle / üye çıkar mutasyonları. */
export function useMembers() {
  const qc = useQueryClient();
  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: memberKeys.members() });

  const membersQ = useQuery({
    queryKey: memberKeys.members(),
    queryFn: membersApi.members,
  });

  const updateRole = useMutation({
    mutationFn: (v: { userId: string; role: Exclude<Role, "owner"> }) =>
      membersApi.updateRole(v.userId, v.role),
    onSuccess: () => {
      toast.success("Rol güncellendi");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, "Güncelleme başarısız")),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => membersApi.removeMember(userId),
    onSuccess: () => {
      toast.success("Üye kaldırıldı");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, "Kaldırma başarısız")),
  });

  return { membersQ, updateRole, remove };
}
