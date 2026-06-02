import type { CashierSession, SessionLifecycleState, SessionSettings } from "@/lib/types";

export interface SessionLifecycleResult {
  lifecycle: SessionLifecycleState;
  hoursOpen: number;
  blocksSales: boolean;
}

export function computeSessionLifecycle(
  session: Pick<CashierSession, "opened_at" | "status">,
  settings: Pick<
    SessionSettings,
    "max_open_hours" | "warn_after_hours" | "block_sales_when_expired"
  >,
  now: Date = new Date()
): SessionLifecycleResult {
  if (session.status !== "open") {
    return { lifecycle: "open", hoursOpen: 0, blocksSales: false };
  }

  const maxHours = Math.max(1, settings.max_open_hours);
  const warnHours = Math.min(Math.max(0, settings.warn_after_hours), maxHours);
  const openedAt = new Date(session.opened_at);
  const hoursOpen = Math.max(0, (now.getTime() - openedAt.getTime()) / (1000 * 60 * 60));

  let lifecycle: SessionLifecycleState = "open";
  if (hoursOpen >= maxHours) {
    lifecycle = "expired_locked";
  } else if (hoursOpen >= warnHours) {
    lifecycle = "warning";
  }

  const blocksSales =
    lifecycle === "expired_locked" && settings.block_sales_when_expired;

  return { lifecycle, hoursOpen, blocksSales };
}

export function formatSessionDuration(hoursOpen: number): string {
  const totalMinutes = Math.floor(hoursOpen * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}
