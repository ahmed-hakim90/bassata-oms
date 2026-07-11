import { cn } from "@/lib/utils";

const variants = {
  default: "bg-muted text-muted-foreground",
  success:
    "bg-[color-mix(in_srgb,var(--mds-color-feedback-success)_15%,transparent)] text-[var(--mds-color-feedback-success)]",
  warning:
    "bg-[color-mix(in_srgb,var(--mds-color-feedback-warning)_15%,transparent)] text-[var(--mds-color-feedback-warning)]",
  danger:
    "bg-[color-mix(in_srgb,var(--mds-color-feedback-danger)_15%,transparent)] text-[var(--mds-color-feedback-danger)]",
  info: "bg-[color-mix(in_srgb,var(--mds-color-feedback-info)_15%,transparent)] text-[var(--mds-color-feedback-info)]",
  draft: "bg-muted text-muted-foreground",
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
        "inline-flex items-center rounded-[var(--mds-radius-pill)] px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {label}
    </span>
  );
}
