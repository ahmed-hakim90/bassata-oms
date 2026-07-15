"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemePreference = "light" | "dark" | "system";
export type LanguagePreference = "en" | "ar";

interface UiState {
  sidebarCollapsed: boolean;
  theme: ThemePreference;
  language: LanguagePreference;
  activeStoreId: string | null;
  collapsedGroups: Record<string, boolean>;
  commandPaletteOpen: boolean;
  /** Mobile drawer (hamburger / More). Not persisted. */
  mobileNavSheetOpen: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: ThemePreference) => void;
  setLanguage: (language: LanguagePreference) => void;
  setActiveStoreId: (storeId: string | null) => void;
  toggleGroup: (groupLabel: string) => void;
  setGroupCollapsed: (groupLabel: string, collapsed: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setMobileNavSheetOpen: (open: boolean) => void;
  openMobileNavSheet: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: "system",
      language: "ar",
      activeStoreId: null,
      collapsedGroups: {},
      commandPaletteOpen: false,
      mobileNavSheetOpen: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setActiveStoreId: (storeId) => set({ activeStoreId: storeId }),
      toggleGroup: (groupLabel) =>
        set((state) => ({
          collapsedGroups: {
            ...state.collapsedGroups,
            [groupLabel]: !state.collapsedGroups[groupLabel],
          },
        })),
      setGroupCollapsed: (groupLabel, collapsed) =>
        set((state) => ({
          collapsedGroups: {
            ...state.collapsedGroups,
            [groupLabel]: collapsed,
          },
        })),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      toggleCommandPalette: () =>
        set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
      setMobileNavSheetOpen: (open) => set({ mobileNavSheetOpen: open }),
      openMobileNavSheet: () => set({ mobileNavSheetOpen: true }),
    }),
    {
      name: "SweetFlow-ui",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        language: state.language,
        activeStoreId: state.activeStoreId,
        collapsedGroups: state.collapsedGroups,
      }),
    }
  )
);
