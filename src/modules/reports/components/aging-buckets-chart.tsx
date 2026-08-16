"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import { ReportChartSection } from "@/modules/reports/components/report-chart-section";
import {
  agingBucketsToChartRows,
  type AgingBuckets,
} from "@/modules/reports/lib/aging-buckets";

interface AgingBucketsChartProps {
  title: string;
  buckets: AgingBuckets;
  currency: string;
  height?: number;
  barColor?: string;
}

export function AgingBucketsChart({
  title,
  buckets,
  currency,
  height = 220,
  barColor = "#0F766E",
}: AgingBucketsChartProps) {
  const data = agingBucketsToChartRows(buckets);
  if (data.every((row) => row.amount <= 0)) return null;

  return (
    <ReportChartSection title={title} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" />
          <YAxis tickFormatter={(v) => String(v)} width={48} />
          <Tooltip
            formatter={(value) =>
              formatCurrency(typeof value === "number" ? value : Number(value), currency)
            }
          />
          <Bar dataKey="amount" fill={barColor} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ReportChartSection>
  );
}
