"use client";

import { useSyncExternalStore } from "react";

/** Platform modifier for Cmd/Ctrl shortcuts (client-only after mount). */
export function getModKeyLabel(): "⌘" | "Ctrl" {
  if (typeof navigator === "undefined") return "Ctrl";
  const platform = navigator.platform ?? "";
  const ua = navigator.userAgent ?? "";
  if (/Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS|iPhone|iPad/i.test(ua)) {
    return "⌘";
  }
  return "Ctrl";
}

export function formatModShortcut(key: string, mod: "⌘" | "Ctrl" = getModKeyLabel()): string {
  return mod === "⌘" ? `⌘${key.toUpperCase()}` : `Ctrl+${key.toUpperCase()}`;
}

const emptySubscribe = () => () => {};

/** Hydration-safe shortcut label (Ctrl on server/SSR, platform-accurate on client). */
export function useModShortcutLabel(key: string): string {
  return useSyncExternalStore(
    emptySubscribe,
    () => formatModShortcut(key, getModKeyLabel()),
    () => formatModShortcut(key, "Ctrl")
  );
}
