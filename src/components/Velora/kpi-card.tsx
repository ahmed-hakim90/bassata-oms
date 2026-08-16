import { cn } from "@/lib/utils";
import { GlassPanel } from "./glass-panel";

interface KpiCardProps {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  className?: string;
}

export function KpiCard({ label, value, change, trend, icon, className }: KpiCardProps) {
  return (
    <GlassPanel
      variant="elevated"
      className={cn(
        "overflow-hidden p-0 transition-shadow hover:shadow-[var(--mds-elevation-2)]",
        className
      )}
    >
      <div className="h-1 w-full bg-[var(--mds-color-action-primary)]" aria-hidden />
      <div className="flex items-start justify-between gap-3 p-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-xl font-semibold tracking-tight tabular-nums text-foreground sm:text-2xl">
            {value}
          </p>
          {change && (
            <p
              className={cn(
                "mt-1 text-xs font-medium",
                trend === "up" && "text-[var(--mds-color-feedback-success)]",
                trend === "down" && "text-[var(--mds-color-feedback-danger)]",
                trend === "neutral" && "text-muted-foreground"
              )}
            >
              {change}
            </p>
          )}
        </div>
        {icon && (
          <div className="flex size-8 items-center justify-center rounded-[var(--mds-radius-md)] bg-[var(--mds-color-harbor-50)] text-[var(--mds-color-action-primary)]">
            {icon}
          </div>
        )}
      </div>
    </GlassPanel>
  );
}
