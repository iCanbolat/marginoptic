import { create } from "zustand";
import type { AuthUser, OrgSummary } from "@churnify/shared";

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  activeOrg: OrgSummary | null;
  organizations: OrgSummary[];
  /** İlk açılışta refresh denemesi tamamlandı mı (route guard'ları bunu bekler). */
  bootstrapped: boolean;

  setSession: (s: {
    accessToken: string;
    user: AuthUser;
    activeOrg: OrgSummary | null;
  }) => void;
  setOrganizations: (orgs: OrgSummary[]) => void;
  setActiveOrg: (org: OrgSummary, accessToken: string) => void;
  setBootstrapped: (v: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  activeOrg: null,
  organizations: [],
  bootstrapped: false,

  setSession: ({ accessToken, user, activeOrg }) =>
    set({ accessToken, user, activeOrg }),
  setOrganizations: (organizations) => set({ organizations }),
  setActiveOrg: (activeOrg, accessToken) => set({ activeOrg, accessToken }),
  setBootstrapped: (bootstrapped) => set({ bootstrapped }),
  clear: () =>
    set({ accessToken: null, user: null, activeOrg: null, organizations: [] }),
}));
