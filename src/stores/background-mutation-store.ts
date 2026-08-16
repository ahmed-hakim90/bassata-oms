"use client";

import { create } from "zustand";

export type BackgroundMutationStatus = "pending" | "success" | "error";

export type BackgroundMutation = {
  key: string;
  label: string;
  status: BackgroundMutationStatus;
  startedAt: number;
  error?: string;
};

type BackgroundMutationState = {
  mutations: Record<string, BackgroundMutation>;
  start: (key: string, label: string) => boolean;
  succeed: (key: string) => void;
  fail: (key: string, error: string) => void;
  clear: (key: string) => void;
  isPending: (key: string) => boolean;
};

/**
 * In-flight operator mutations (receive, checkout, deliver, transfer).
 * Not persisted — closing the tab loses the toast, DB remains source of truth.
 */
export const useBackgroundMutationStore = create<BackgroundMutationState>((set, get) => ({
  mutations: {},
  start: (key, label) => {
    if (get().mutations[key]?.status === "pending") return false;
    set((state) => ({
      mutations: {
        ...state.mutations,
        [key]: { key, label, status: "pending", startedAt: Date.now() },
      },
    }));
    return true;
  },
  succeed: (key) => {
    set((state) => {
      const current = state.mutations[key];
      if (!current) return state;
      const next = { ...state.mutations };
      delete next[key];
      return { mutations: next };
    });
  },
  fail: (key, error) => {
    set((state) => {
      const current = state.mutations[key];
      if (!current) return state;
      return {
        mutations: {
          ...state.mutations,
          [key]: { ...current, status: "error", error },
        },
      };
    });
  },
  clear: (key) => {
    set((state) => {
      if (!state.mutations[key]) return state;
      const next = { ...state.mutations };
      delete next[key];
      return { mutations: next };
    });
  },
  isPending: (key) => get().mutations[key]?.status === "pending",
}));
