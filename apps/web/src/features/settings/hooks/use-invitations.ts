import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { membersApi } from "../api/members-api";
import { memberKeys } from "./member-keys";
import { errMsg } from "../utils/errors";
import type { InviteMemberInput } from "../types/member-types";

/** Bekleyen davetler: liste sorgusu + davet oluştur mutasyonu. */
export function useInvitations(enabled: boolean) {
  const qc = useQueryClient();

  const invitesQ = useQuery({
    queryKey: memberKeys.invitations(),
    queryFn: membersApi.invitations,
    enabled,
  });

  const invite = useMutation({
    mutationFn: (input: InviteMemberInput) => membersApi.invite(input),
    onSuccess: (res) => {
      toast.success(`Davet oluşturuldu: ${res.email}`);
      void qc.invalidateQueries({ queryKey: memberKeys.invitations() });
    },
    onError: (e) => toast.error(errMsg(e, "Davet başarısız")),
  });

  return { invitesQ, invite };
}
