import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  /** Sidebar daraltılmış mı (yalnızca ikon modu). */
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

export const useSidebar = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
      setCollapsed: (collapsed) => set({ collapsed }),
    }),
    { name: "churnify-sidebar" },
  ),
);
