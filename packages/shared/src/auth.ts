import { z } from "zod";

/** Organizasyon içi roller (yetki sırasına göre). */
export const ROLES = ["owner", "admin", "analyst", "viewer"] as const;
export type Role = (typeof ROLES)[number];
export const roleSchema = z.enum(ROLES);

/** Davet edilebilir roller — owner devredilemez/atanamaz. */
export const assignableRoleSchema = roleSchema.exclude(["owner"]);

// ---------------------------------------------------------------------------
// İstek (request) şemaları — hem API (ZodValidationPipe) hem web (react-hook-form)
// ---------------------------------------------------------------------------

export const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(200),
  organizationName: z.string().min(1).max(200).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const switchOrgSchema = z.object({
  organizationId: z.string().uuid(),
});
export type SwitchOrgInput = z.infer<typeof switchOrgSchema>;

export const createOrgSchema = z.object({
  name: z.string().min(1).max(200),
});
export type CreateOrgInput = z.infer<typeof createOrgSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().email().max(320),
  role: assignableRoleSchema,
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: assignableRoleSchema,
});
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(10),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

// ---------------------------------------------------------------------------
// Yanıt (response) sözleşmeleri
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  role: Role;
}

export interface SessionResponse {
  accessToken: string;
  user: AuthUser;
  activeOrg: OrgSummary | null;
}

export interface MeResponse {
  user: AuthUser;
  organizations: OrgSummary[];
}

export interface SwitchOrgResponse {
  accessToken: string;
  activeOrg: OrgSummary;
}

export interface MemberView {
  userId: string;
  email: string;
  name: string;
  role: Role;
  joinedAt: string;
}

export interface InvitationView {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  createdAt: string;
}

/** Davet oluşturma yanıtı — e-posta entegrasyonu Faz 9'a kadar link stub'ı döner. */
export interface InvitationCreatedResponse extends InvitationView {
  acceptUrl: string;
}
