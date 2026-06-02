import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";

interface KpiPulseProps extends React.ComponentProps<"div"> {
  label: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
}

export function KpiPulse({
  label,
  value,
  change,
  changeLabel,
  icon,
  className,
  ...props
}: KpiPulseProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <div
      className={cn(
        "glass-panel group relative overflow-hidden rounded-[var(--radius-card)] border border-border/50 p-5",
        className
      )}
      {...props}
    >
      <div className="absolute -right-6 -top-6 size-24 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-100 opacity-60" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold tracking-tight">{value}</p>
          {change !== undefined ? (
            <div
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}
            >
              {isPositive ? (
                <TrendingUp className="size-3.5" />
              ) : (
                <TrendingDown className="size-3.5" />
              )}
              <span>{Math.abs(change).toFixed(1)}%</span>
              {changeLabel ? (
                <span className="text-muted-foreground">{changeLabel}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        {icon ? (
          <div className="flex size-10 items-center justify-center rounded-[var(--radius-button)] bg-primary/10 text-primary">
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
