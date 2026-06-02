import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SessionLifecycleState } from "@/lib/types";

const LABELS: Record<SessionLifecycleState, string> = {
  open: "Open",
  warning: "Warning",
  expired_locked: "Expired",
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
        lifecycle === "warning" && "bg-amber-100 text-amber-900 hover:bg-amber-100",
        className
      )}
    >
      {LABELS[lifecycle]}
    </Badge>
  );
}
