import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps extends ComponentProps<"div"> {
  variant?: "default" | "elevated";
}

export function GlassPanel({
  className,
  variant = "default",
  ...props
}: GlassPanelProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-white/20 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-white/5",
        variant === "elevated" && "shadow-lg shadow-black/5 dark:shadow-black/30",
        className
      )}
      {...props}
    />
  );
}
