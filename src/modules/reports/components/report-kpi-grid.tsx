"use client";

import { KpiCard } from "@/components/SweetFlow/kpi-card";
import { cn } from "@/lib/utils";

export interface ReportKpiItem {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
}

interface ReportKpiGridProps {
  items: ReportKpiItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

export function ReportKpiGrid({ items, columns = 4, className }: ReportKpiGridProps) {
  const gridClass =
    columns === 2
      ? "sm:grid-cols-2"
      : columns === 3
        ? "sm:grid-cols-2 lg:grid-cols-3"
        : "sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className={cn("grid gap-[var(--mds-space-4)]", gridClass, className)}>
      {items.map((item) => (
        <KpiCard
          key={item.label}
          label={item.label}
          value={item.value}
          change={item.change}
          trend={item.trend}
          icon={item.icon}
        />
      ))}
    </div>
  );
}
