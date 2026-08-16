import type { CashierSession } from "@/lib/types";
import type { OpenSessionSummary } from "@/modules/sessions/services/open-session-summary.service";
import type { SessionsGlanceChartRow } from "@/modules/sessions/components/sessions-analytics-glance";

/** Pure glance aggregates from already-loaded session rows — no extra DB. */
export function buildSessionsGlance(input: {
  openSummaries: OpenSessionSummary[];
  closedSessions: CashierSession[];
  userMap: Record<string, string>;
  days?: number;
}): {
  openCount: number;
  openSalesTotal: number;
  closed30dCount: number;
  variance30d: number;
  varianceChart: SessionsGlanceChartRow[];
} {
  const days = input.days ?? 30;
  const fromMs = Date.now() - days * 24 * 60 * 60 * 1000;

  const closedInRange = input.closedSessions.filter((s) => {
    const at = s.closed_at ?? s.opened_at;
    return new Date(at).getTime() >= fromMs;
  });

  const byCashier = new Map<string, number>();
  let variance30d = 0;
  for (const s of closedInRange) {
    const v = s.variance ?? 0;
    variance30d += v;
    byCashier.set(s.cashier_id, (byCashier.get(s.cashier_id) ?? 0) + v);
  }

  const varianceChart = [...byCashier.entries()]
    .map(([cashierId, variance]) => ({
      label: (input.userMap[cashierId] ?? "كاشير").slice(0, 12),
      variance: Math.round(variance * 100) / 100,
    }))
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
    .slice(0, 8);

  return {
    openCount: input.openSummaries.length,
    openSalesTotal: input.openSummaries.reduce((sum, row) => sum + row.totalSales, 0),
    closed30dCount: closedInRange.length,
    variance30d: Math.round(variance30d * 100) / 100,
    varianceChart,
  };
}
