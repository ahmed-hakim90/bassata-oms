"use client";

import { useEffect, useRef } from "react";
import {
  isShortcutBlocked,
  matchOperatorShortcut,
  type OperatorShortcutAction,
} from "@/lib/keyboard";

export type OperatorShortcutHandlers = {
  onSave?: () => void;
  onDelete?: () => void;
  onUndo?: () => void;
  onHold?: () => void;
  onCustomer?: () => void;
  onDiscount?: () => void;
  /** When false, listener is inactive. Default true. */
  enabled?: boolean;
};

const ACTION_TO_HANDLER: Record<
  OperatorShortcutAction,
  keyof Omit<OperatorShortcutHandlers, "enabled">
> = {
  save: "onSave",
  delete: "onDelete",
  undo: "onUndo",
  hold: "onHold",
  customer: "onCustomer",
  discount: "onDiscount",
};

/**
 * Window-level operator shortcuts (F1–F4, F6–F7).
 * Works even when focus is in search/qty inputs; blocked while a dialog is open.
 */
export function useOperatorShortcuts({
  onSave,
  onDelete,
  onUndo,
  onHold,
  onCustomer,
  onDiscount,
  enabled = true,
}: OperatorShortcutHandlers): void {
  const handlersRef = useRef({
    onSave,
    onDelete,
    onUndo,
    onHold,
    onCustomer,
    onDiscount,
  });
  handlersRef.current = {
    onSave,
    onDelete,
    onUndo,
    onHold,
    onCustomer,
    onDiscount,
  };

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      const action = matchOperatorShortcut(event);
      if (!action) return;
      if (isShortcutBlocked(event, action)) return;

      const handlerKey = ACTION_TO_HANDLER[action];
      const handler = handlersRef.current[handlerKey];
      if (!handler) return;

      event.preventDefault();
      handler();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
