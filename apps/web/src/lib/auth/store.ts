import { create } from "zustand";
import type { AuthUser, StoreView } from "@churnify/shared";

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  activeStore: StoreView | null;
  stores: StoreView[];
  /** İlk açılışta refresh denemesi tamamlandı mı (route guard'ları bunu bekler). */
  bootstrapped: boolean;

  setSession: (s: {
    accessToken: string;
    user: AuthUser;
    activeStore: StoreView | null;
  }) => void;
  setStores: (stores: StoreView[]) => void;
  setActiveStore: (store: StoreView, accessToken: string) => void;
  setBootstrapped: (v: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  activeStore: null,
  stores: [],
  bootstrapped: false,

  setSession: ({ accessToken, user, activeStore }) =>
    set({ accessToken, user, activeStore }),
  setStores: (stores) => set({ stores }),
  setActiveStore: (activeStore, accessToken) => set({ activeStore, accessToken }),
  setBootstrapped: (bootstrapped) => set({ bootstrapped }),
  clear: () =>
    set({ accessToken: null, user: null, activeStore: null, stores: [] }),
}));
