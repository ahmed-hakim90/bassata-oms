import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SessionLifecycleState } from "@/lib/types";

const LABELS: Record<SessionLifecycleState, string> = {
  open: "مفتوحة",
  warning: "قربت تنتهي",
  expired_locked: "منتهية",
};

interface SessionLifecycleBadgeProps {
  lifecycle: SessionLifecycleState;
  className?: string;
}

export function SessionLifecycleBadge({ lifecycle, className }: SessionLifecycleBadgeProps) {
  return (
    <Badge
      variant={
        lifecycle === "expired_locked"
          ? "destructive"
          : lifecycle === "warning"
            ? "secondary"
            : "default"
      }
      className={cn(
        lifecycle === "open" &&
          "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
        lifecycle === "warning" &&
          "bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/20",
        className
      )}
    >
      {LABELS[lifecycle]}
    </Badge>
  );
}
