"use client";

import { create } from "zustand";
import {
  normalizePathname,
  shouldShowRouteSkeleton,
} from "@/lib/route-transition";

type RouteTransitionState = {
  pendingPath: string | null;
  start: (path: string, options?: { force?: boolean }) => void;
  clear: () => void;
};

function destinationPathname(path: string, origin: string): string | null {
  try {
    return new URL(path, origin).pathname;
  } catch {
    return null;
  }
}

/**
 * Instant route pending flag. Not persisted — it only exists while a
 * client navigation is in flight so the shell can show a skeleton immediately.
 */
export const useRouteTransitionStore = create<RouteTransitionState>((set, get) => ({
  pendingPath: null,
  start: (path, options) => {
    if (!path) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "http://local.invalid";
    const next = destinationPathname(path, origin);
    if (!next || !shouldShowRouteSkeleton(next)) return;
    if (!options?.force && typeof window !== "undefined") {
      const current = normalizePathname(window.location.pathname);
      if (current === normalizePathname(next)) return;
    }
    if (get().pendingPath === next) return;
    set({ pendingPath: next });
  },
  clear: () => {
    if (get().pendingPath === null) return;
    set({ pendingPath: null });
  },
}));
