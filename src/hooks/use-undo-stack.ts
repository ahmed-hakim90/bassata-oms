"use client";

import { useCallback, useRef, useState } from "react";

const DEFAULT_MAX = 20;

export type UndoEntry<T> = {
  label?: string;
  undo: () => void;
  /** Optional payload for tests / debugging. */
  payload?: T;
};

/**
 * Bounded local undo stack for document line edits (add / qty / remove).
 * Not a server rollback — caller owns applying the inverse mutation.
 */
export function useUndoStack<T = unknown>(maxSize = DEFAULT_MAX) {
  const stackRef = useRef<UndoEntry<T>[]>([]);
  const [depth, setDepth] = useState(0);

  const push = useCallback(
    (entry: UndoEntry<T>) => {
      const next = [...stackRef.current, entry];
      if (next.length > maxSize) next.splice(0, next.length - maxSize);
      stackRef.current = next;
      setDepth(next.length);
    },
    [maxSize]
  );

  const undo = useCallback((): boolean => {
    const entry = stackRef.current.pop();
    if (!entry) return false;
    setDepth(stackRef.current.length);
    entry.undo();
    return true;
  }, []);

  const clear = useCallback(() => {
    stackRef.current = [];
    setDepth(0);
  }, []);

  const canUndo = depth > 0;

  return { push, undo, clear, canUndo, depth };
}
