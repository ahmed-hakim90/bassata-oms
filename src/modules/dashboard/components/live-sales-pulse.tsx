"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { formatCurrency } from "@/lib/format";

interface LiveSalesPulseProps {
  data: { hour: string; total: number }[];
  todaySales: number;
}

const HARBOR = "#0E7490";

export function LiveSalesPulse({ data, todaySales }: LiveSalesPulseProps) {
  return (
    <div className="rounded-[var(--mds-radius-lg)] border border-border bg-card p-5 text-card-foreground shadow-[var(--mds-elevation-1)]">
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-sm font-medium text-muted-foreground">مبيعات اليوم</p>
        <p className="text-2xl font-semibold tabular-nums tracking-tight">
          {formatCurrency(todaySales)}
        </p>
      </div>
      <div className="h-[140px] min-h-[140px] min-w-0 w-full">
        {data.some((d) => d.total > 0) ? (
        <ResponsiveContainer width="100%" height={140} minWidth={0}>
          <AreaChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={HARBOR} stopOpacity={0.25} />
                <stop offset="100%" stopColor={HARBOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10, fill: "#94A3B8" }}
              axisLine={false}
              tickLine={false}
              interval={3}
            />
            <Tooltip
              formatter={(v) => formatCurrency(Number(v))}
              labelFormatter={(l) => l}
              contentStyle={{
                borderRadius: 10,
                border: "1px solid var(--mds-color-border-default)",
                boxShadow: "var(--mds-elevation-2)",
              }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke={HARBOR}
              strokeWidth={2}
              fill="url(#salesFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
        ) : (
          <EmptyStateBlock
            title="مفيش مبيعات النهاردة لسة"
            className="flex h-full min-h-[120px] items-center justify-center border-0 bg-transparent p-[var(--mds-space-3)] shadow-none"
          />
        )}
      </div>
    </div>
  );
}
