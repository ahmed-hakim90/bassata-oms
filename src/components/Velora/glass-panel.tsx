import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps extends ComponentProps<"div"> {
  variant?: "default" | "elevated";
}

/** Calm Meridian surface panel (legacy name retained for call-site compatibility). */
export function GlassPanel({
  className,
  variant = "default",
  ...props
}: GlassPanelProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--mds-radius-lg)] border border-border bg-card",
        variant === "elevated" && "shadow-[var(--mds-elevation-2)]",
        variant === "default" && "shadow-[var(--mds-elevation-1)]",
        className
      )}
      {...props}
    />
  );
}
