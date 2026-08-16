import type { KitchenStatus, KitchenTicket } from "@/modules/kitchen/services/kitchen.service";

export const KITCHEN_STATUS_LABELS_AR: Record<
  Exclude<KitchenStatus, "served">,
  string
> = {
  queued: "بالانتظار",
  preparing: "قيد التحضير",
  ready: "جاهز",
};

export type KitchenGlance = {
  backlog: number;
  queued: number;
  preparing: number;
  ready: number;
  /** Minutes since created_at of the oldest open ticket — not measured prep time. */
  oldestWaitMinutes: number | null;
  statusChart: { label: string; count: number }[];
};

/**
 * Pure glance from already-loaded kitchen tickets.
 * No prep-duration events exist yet — we only report queue depth + age since order created.
 */
export function buildKitchenGlance(tickets: KitchenTicket[]): KitchenGlance {
  let queued = 0;
  let preparing = 0;
  let ready = 0;
  let oldestMs: number | null = null;
  const now = Date.now();

  for (const ticket of tickets) {
    if (ticket.kitchenStatus === "queued") queued += 1;
    else if (ticket.kitchenStatus === "preparing") preparing += 1;
    else if (ticket.kitchenStatus === "ready") ready += 1;

    const created = new Date(ticket.createdAt).getTime();
    if (!Number.isNaN(created)) {
      if (oldestMs == null || created < oldestMs) oldestMs = created;
    }
  }

  const statusChart = (
    [
      ["queued", queued],
      ["preparing", preparing],
      ["ready", ready],
    ] as const
  )
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      label: KITCHEN_STATUS_LABELS_AR[status],
      count,
    }));

  return {
    backlog: queued + preparing + ready,
    queued,
    preparing,
    ready,
    oldestWaitMinutes:
      oldestMs == null ? null : Math.max(0, Math.floor((now - oldestMs) / 60000)),
    statusChart,
  };
}
