"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";

interface LiveSalesPulseProps {
  data: { hour: string; total: number }[];
  todaySales: number;
}

export function LiveSalesPulse({ data, todaySales }: LiveSalesPulseProps) {
  return (
    <div className="rounded-2xl bg-card p-5 text-card-foreground ring-1 ring-border">
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-sm font-medium text-muted-foreground">Today&apos;s sales</p>
        <p className="text-2xl font-bold tabular-nums tracking-tight">
          {formatCurrency(todaySales)}
        </p>
      </div>
      <div className="h-[120px] min-w-0 w-full">
        {data.some((d) => d.total > 0) ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
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
                borderRadius: 12,
                border: "none",
                boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
              }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#2563EB"
              strokeWidth={2}
              fill="url(#salesFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No sales yet today
          </div>
        )}
      </div>
    </div>
  );
}
