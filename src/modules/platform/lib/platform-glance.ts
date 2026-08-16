import type {
  PlatformOrganizationSummary,
  PlatformRollup,
} from "@/modules/platform/services/platform-org.service";
import { getPlatformRollup } from "@/modules/platform/services/platform-org.service";
import type {
  PlatformOrgUsageRow,
  PlatformPlanId,
} from "@/modules/platform/services/platform-plan.service";

const QUIET_MS = 30 * 24 * 60 * 60 * 1000;

const PLAN_LABELS: Record<PlatformPlanId, string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
  custom: "مخصص",
};

export type PlatformOrgGlance = PlatformRollup & {
  /** Active orgs with no last order, or last order older than 30 days — not churn. */
  quietOrgs: number;
  topOrgsByOrders: { label: string; orders: number }[];
  statusChart: { label: string; count: number }[];
};

export type PlatformUsageGlance = {
  total: number;
  over: number;
  near: number;
  ok: number;
  suspended: number;
  byPlanChart: { label: string; count: number }[];
  byPressureChart: { label: string; count: number }[];
};

/**
 * Pure SaaS control-plane glance from already-loaded org health summaries.
 * No MRR/billing metrics — Stripe is planned, not live.
 */
export function buildPlatformOrgGlance(input: {
  organizations: PlatformOrganizationSummary[];
  pendingInvites: number;
  nowMs?: number;
}): PlatformOrgGlance {
  const now = input.nowMs ?? Date.now();
  const rollup = getPlatformRollup(input.organizations, input.pendingInvites);

  let quietOrgs = 0;
  for (const org of input.organizations) {
    if (org.status === "suspended") continue;
    const last = org.health.lastOrderAt
      ? new Date(org.health.lastOrderAt).getTime()
      : null;
    if (last == null || Number.isNaN(last) || now - last > QUIET_MS) {
      quietOrgs += 1;
    }
  }

  const topOrgsByOrders = [...input.organizations]
    .map((org) => ({
      label: org.name.slice(0, 14),
      orders: org.health.orderCount,
    }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 8);

  const statusChart = [
    { label: "نشطة", count: rollup.orgActive },
    { label: "معلّقة", count: rollup.orgSuspended },
  ].filter((row) => row.count > 0);

  return {
    ...rollup,
    quietOrgs,
    topOrgsByOrders,
    statusChart,
  };
}

/**
 * Pure usage-matrix glance from already-loaded plan/pressure rows.
 * Pressure = capacity vs manual plan limits — not payment status.
 */
export function buildPlatformUsageGlance(
  rows: Pick<PlatformOrgUsageRow, "org_status" | "plan" | "pressure">[]
): PlatformUsageGlance {
  let over = 0;
  let near = 0;
  let ok = 0;
  let suspended = 0;
  const byPlan = new Map<string, number>();

  for (const row of rows) {
    if (row.org_status === "suspended") suspended += 1;
    const planLabel = PLAN_LABELS[row.plan.plan] ?? row.plan.plan;
    byPlan.set(planLabel, (byPlan.get(planLabel) ?? 0) + 1);

    if (row.pressure.worst === "over") over += 1;
    else if (row.pressure.worst === "near") near += 1;
    else ok += 1;
  }

  const byPlanChart = [...byPlan.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const byPressureChart = [
    { label: "طبيعي", count: ok },
    { label: "قرب الحد", count: near },
    { label: "تجاوز", count: over },
  ].filter((row) => row.count > 0);

  return {
    total: rows.length,
    over,
    near,
    ok,
    suspended,
    byPlanChart,
    byPressureChart,
  };
}
