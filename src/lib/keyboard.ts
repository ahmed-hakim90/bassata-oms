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

/** Operator document / POS shortcuts. Avoid F5/F11/F12 (browser conflicts). */
export const OPERATOR_SHORTCUTS = {
  save: "F1",
  delete: "F2",
  undo: "F3",
  /** POS: park / hold current cart */
  hold: "F4",
  /** POS: open customer attach */
  customer: "F6",
  /** POS: open discount field (when discounts enabled) */
  discount: "F7",
} as const;

export type OperatorShortcutAction = keyof typeof OPERATOR_SHORTCUTS;

const KEY_TO_ACTION: Record<string, OperatorShortcutAction> = {
  F1: "save",
  F2: "delete",
  F3: "undo",
  F4: "hold",
  F6: "customer",
  F7: "discount",
};

/** Map a keyboard event to an operator shortcut action, or null. */
export function matchOperatorShortcut(
  event: Pick<KeyboardEvent, "key" | "code">
): OperatorShortcutAction | null {
  const fromKey = KEY_TO_ACTION[event.key];
  if (fromKey) return fromKey;
  const fromCode = KEY_TO_ACTION[event.code];
  return fromCode ?? null;
}

export type ShortcutBlockOptions = {
  /** When true, block listed actions on key-repeat (default: save/delete/hold). */
  blockRepeatFor?: OperatorShortcutAction[];
  /** Override document (tests); default is global document when available. */
  document?: Document | null;
};

/**
 * Whether operator shortcuts should be ignored for this event.
 * Blocks when a dialog/alertdialog is open, during IME composition, or on repeat for save/delete/hold.
 */
export function isShortcutBlocked(
  event: Pick<KeyboardEvent, "repeat" | "isComposing" | "target">,
  action: OperatorShortcutAction,
  options?: ShortcutBlockOptions
): boolean {
  if (event.isComposing) return true;

  const blockRepeatFor =
    options?.blockRepeatFor ??
    (["save", "delete", "hold"] as OperatorShortcutAction[]);
  if (event.repeat && blockRepeatFor.includes(action)) return true;

  const doc =
    options && "document" in options
      ? options.document
      : typeof document !== "undefined"
        ? document
        : null;

  if (doc) {
    // Base UI Dialog uses data-open on popup/overlay; also catch role=dialog open state.
    const openDialog = doc.querySelector(
      [
        '[data-slot="dialog-content"][data-open]',
        '[data-slot="dialog-overlay"][data-open]',
        '[role="dialog"][data-open]',
        '[role="alertdialog"][data-open]',
        '[role="dialog"][data-state="open"]',
        '[role="alertdialog"][data-state="open"]',
      ].join(", ")
    );
    if (openDialog) return true;
  }

  return false;
}

/** Arabic hint strip — documents (F1–F3). */
export const OPERATOR_SHORTCUT_HINT = "F1 حفظ · F2 مسح · F3 تراجع";

/** Arabic hint strip — POS (F1–F4 + F6–F7). */
export const POS_OPERATOR_SHORTCUT_HINT =
  "F1 دفع · F2 مسح · F3 تراجع · F4 تعليق · F6 عميل · F7 خصم";
