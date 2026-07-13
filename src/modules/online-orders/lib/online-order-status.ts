import type { OnlineOrderStatus } from "@/lib/types";

/**
 * Forward-only fulfillment transitions for first-party online orders.
 * Invoice is a separate action (not a status button).
 */
const FORWARD: Record<
  OnlineOrderStatus,
  ReadonlyArray<Exclude<OnlineOrderStatus, "invoiced">>
> = {
  pending: ["accepted", "preparing", "ready", "cancelled"],
  accepted: ["preparing", "ready", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["cancelled"],
  cancelled: [],
  invoiced: [],
};

export function allowedOnlineOrderStatusTransitions(
  from: OnlineOrderStatus
): ReadonlyArray<Exclude<OnlineOrderStatus, "invoiced">> {
  return FORWARD[from] ?? [];
}

export function canTransitionOnlineOrderStatus(
  from: OnlineOrderStatus,
  to: Exclude<OnlineOrderStatus, "invoiced">
): boolean {
  if (from === to) return true;
  return allowedOnlineOrderStatusTransitions(from).includes(to);
}

/** Primary (non-cancel) next step for board CTA. */
export function primaryNextOnlineOrderStatus(
  from: OnlineOrderStatus
): Exclude<OnlineOrderStatus, "invoiced" | "cancelled"> | null {
  const next = allowedOnlineOrderStatusTransitions(from).find((status) => status !== "cancelled");
  return (next as Exclude<OnlineOrderStatus, "invoiced" | "cancelled"> | undefined) ?? null;
}

export function canCancelOnlineOrder(from: OnlineOrderStatus): boolean {
  return allowedOnlineOrderStatusTransitions(from).includes("cancelled");
}
