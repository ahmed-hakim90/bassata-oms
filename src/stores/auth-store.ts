"use client";

import { create } from "zustand";
import type { AppUser } from "@/lib/types";

interface AuthState {
  user: AppUser | null;
  activeStoreId: string | null;
  deviceUnlocked: boolean;
  cashierId: string | null;
  hydrated: boolean;
  setAuth: (payload: {
    user: AppUser | null;
    activeStoreId?: string | null;
    deviceUnlocked?: boolean;
    cashierId?: string | null;
  }) => void;
  setHydrated: (hydrated: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  activeStoreId: null,
  deviceUnlocked: false,
  cashierId: null,
  hydrated: false,
  setAuth: (payload) =>
    set((state) => ({
      user: payload.user,
      activeStoreId:
        payload.activeStoreId !== undefined
          ? payload.activeStoreId
          : state.activeStoreId,
      deviceUnlocked:
        payload.deviceUnlocked !== undefined
          ? payload.deviceUnlocked
          : state.deviceUnlocked,
      cashierId:
        payload.cashierId !== undefined ? payload.cashierId : state.cashierId,
    })),
  setHydrated: (hydrated) => set({ hydrated }),
  clearAuth: () =>
    set({
      user: null,
      activeStoreId: null,
      deviceUnlocked: false,
      cashierId: null,
    }),
}));
