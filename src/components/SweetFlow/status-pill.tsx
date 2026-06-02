import { cn } from "@/lib/utils";

const variants = {
  default: "bg-muted text-muted-foreground",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  danger: "bg-red-500/15 text-red-700 dark:text-red-400",
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  draft: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
} as const;

interface StatusPillProps {
  label: string;
  variant?: keyof typeof variants;
  className?: string;
}

export function StatusPill({ label, variant = "default", className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {label}
    </span>
  );
}
