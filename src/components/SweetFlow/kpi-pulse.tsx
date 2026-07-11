import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";
import { GlassPanel } from "./glass-panel";

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
    <GlassPanel
      className={cn("group relative overflow-hidden p-5", className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold tracking-tight">{value}</p>
          {change !== undefined ? (
            <div
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                isPositive
                  ? "text-[var(--mds-color-feedback-success)]"
                  : "text-[var(--mds-color-feedback-danger)]"
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
          <div className="flex size-10 items-center justify-center rounded-[var(--mds-radius-md)] bg-accent text-accent-foreground">
            {icon}
          </div>
        ) : null}
      </div>
    </GlassPanel>
  );
}
