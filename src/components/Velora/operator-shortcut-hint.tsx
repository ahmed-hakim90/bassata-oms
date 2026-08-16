"use client";

import {
  OPERATOR_SHORTCUT_HINT,
  POS_OPERATOR_SHORTCUT_HINT,
} from "@/lib/keyboard";
import { cn } from "@/lib/utils";

interface OperatorShortcutHintProps {
  className?: string;
  /** POS shows F4/F6/F7; documents stay on F1–F3. */
  variant?: "document" | "pos";
}

/** Desktop-only discovery strip for operator shortcuts. */
export function OperatorShortcutHint({
  className,
  variant = "document",
}: OperatorShortcutHintProps) {
  const text =
    variant === "pos" ? POS_OPERATOR_SHORTCUT_HINT : OPERATOR_SHORTCUT_HINT;
  return (
    <p
      className={cn(
        "hidden text-[11px] text-muted-foreground tabular-nums md:block",
        className
      )}
      aria-hidden
    >
      {text}
    </p>
  );
}
