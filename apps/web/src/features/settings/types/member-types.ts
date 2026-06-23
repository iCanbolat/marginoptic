// Shared org/üyelik sözleşmelerini feature içi tek import noktası olarak yeniden ihraç et.
export { ROLES, inviteMemberSchema } from "@churnify/shared";
export type {
  Role,
  MemberView,
  InvitationView,
  InvitationCreatedResponse,
  InviteMemberInput,
} from "@churnify/shared";

import type { Role } from "@churnify/shared";

/** Davet/rol değişiminde atanabilir roller (owner hariç). */
export const ASSIGNABLE_ROLES: Exclude<Role, "owner">[] = [
  "admin",
  "analyst",
  "viewer",
];
