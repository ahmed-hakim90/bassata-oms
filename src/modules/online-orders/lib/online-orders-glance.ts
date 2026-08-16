import type { OnlineOrder, OnlineOrderStatus } from "@/lib/types";
import type { OnlineMenuViewStats } from "@/modules/online-menu/services/online-menu-views.service";
import { ONLINE_MENU_VIEW_SOURCE_LABELS_AR } from "@/modules/online-menu/lib/online-menu-view-source";

export const ONLINE_ORDER_STATUS_LABELS_AR: Record<OnlineOrderStatus, string> = {
  pending: "معلق",
  accepted: "مقبول",
  preparing: "قيد التحضير",
  ready: "جاهز",
  cancelled: "ملغي",
  invoiced: "تم الريسيت",
};

const STATUS_CHART_ORDER: OnlineOrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "invoiced",
  "cancelled",
];

export type OnlineOrdersGlance = {
  total: number;
  active: number;
  pending: number;
  ready: number;
  /** Average order value for non-cancelled orders in the loaded set. */
  aov: number;
  revenueNonCancelled: number;
  statusChart: { label: string; count: number }[];
  sourceChart: { label: string; count: number }[];
  menuViewsTotal: number;
  menuViewsDays: number;
};

/** Pure aggregates from already-loaded orders + optional menu view stats — no DB. */
export function buildOnlineOrdersGlance(input: {
  orders: Pick<OnlineOrder, "status" | "total">[];
  menuViewStats?: OnlineMenuViewStats | null;
}): OnlineOrdersGlance {
  const counts: Record<OnlineOrderStatus, number> = {
    pending: 0,
    accepted: 0,
    preparing: 0,
    ready: 0,
    cancelled: 0,
    invoiced: 0,
  };

  let revenueNonCancelled = 0;
  let nonCancelledCount = 0;

  for (const order of input.orders) {
    counts[order.status] += 1;
    if (order.status !== "cancelled") {
      revenueNonCancelled += order.total;
      nonCancelledCount += 1;
    }
  }

  const active =
    counts.pending + counts.accepted + counts.preparing + counts.ready;

  const statusChart = STATUS_CHART_ORDER.filter((status) => counts[status] > 0).map(
    (status) => ({
      label: ONLINE_ORDER_STATUS_LABELS_AR[status],
      count: counts[status],
    })
  );

  const menuViewStats = input.menuViewStats ?? null;
  const sourceChart = (menuViewStats?.bySource ?? [])
    .filter((row) => row.viewCount > 0)
    .map((row) => ({
      label: ONLINE_MENU_VIEW_SOURCE_LABELS_AR[row.source] ?? row.source,
      count: row.viewCount,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    total: input.orders.length,
    active,
    pending: counts.pending,
    ready: counts.ready,
    aov:
      nonCancelledCount > 0
        ? Math.round((revenueNonCancelled / nonCancelledCount) * 100) / 100
        : 0,
    revenueNonCancelled: Math.round(revenueNonCancelled * 100) / 100,
    statusChart,
    sourceChart,
    menuViewsTotal: menuViewStats?.total ?? 0,
    menuViewsDays: menuViewStats?.days ?? 7,
  };
}
