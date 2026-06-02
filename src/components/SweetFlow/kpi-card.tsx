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
      className={cn("p-6 transition-all hover:shadow-xl", className)}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          {change && (
            <p
              className={cn(
                "mt-2 text-sm font-medium",
                trend === "up" && "text-emerald-600",
                trend === "down" && "text-red-600",
                trend === "neutral" && "text-muted-foreground"
              )}
            >
              {change}
            </p>
          )}
        </div>
        {icon && (
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {icon}
          </div>
        )}
      </div>
    </GlassPanel>
  );
}
