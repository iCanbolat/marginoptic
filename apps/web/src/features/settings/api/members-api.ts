import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import type {
  InvitationCreatedResponse,
  InvitationView,
  InviteMemberInput,
  MemberView,
  Role,
} from "../types/member-types";

/**
 * Org üyelik DAL — saf axios çağrıları (üyeler, davetler, rol/çıkarma).
 * Org genelinde scope'lanır (aktif org cookie/oturumdan).
 */
export const membersApi = {
  members: (): Promise<MemberView[]> =>
    apiGet<MemberView[]>("/organizations/members"),

  invitations: (): Promise<InvitationView[]> =>
    apiGet<InvitationView[]>("/organizations/invitations"),

  invite: (input: InviteMemberInput): Promise<InvitationCreatedResponse> =>
    apiPost<InvitationCreatedResponse>("/organizations/invitations", input),

  updateRole: (userId: string, role: Exclude<Role, "owner">): Promise<{ ok: true }> =>
    apiPatch<{ ok: true }>(`/organizations/members/${userId}/role`, { role }),

  removeMember: (userId: string): Promise<void> =>
    apiDelete(`/organizations/members/${userId}`),
};
