import { create } from "zustand";
import { persist } from "zustand/middleware";

interface StoreSelectionState {
  /** null = "Tüm mağazalar" */
  activeStoreId: string | null;
  setActiveStoreId: (id: string | null) => void;
}

export const useStoreSelection = create<StoreSelectionState>()(
  persist(
    (set) => ({
      activeStoreId: null,
      setActiveStoreId: (activeStoreId) => set({ activeStoreId }),
    }),
    { name: "churnify-store-selection" },
  ),
);
