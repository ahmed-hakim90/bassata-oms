import type { Device } from "@/lib/repositories/device.repository";

export type DevicesGlance = {
  total: number;
  active: number;
  inactive: number;
  seenRecently: number;
  staleOrNever: number;
  byStoreChart: { label: string; count: number }[];
};

const RECENT_MS = 24 * 60 * 60 * 1000;

/**
 * Pure glance from already-loaded devices.
 * "Stale" = active but never seen, or last_seen older than 24h — not a hardware fault log.
 */
export function buildDevicesGlance(input: {
  devices: Pick<Device, "store_id" | "is_active" | "last_seen_at">[];
  storeNames: Record<string, string>;
  nowMs?: number;
}): DevicesGlance {
  const now = input.nowMs ?? Date.now();
  let active = 0;
  let inactive = 0;
  let seenRecently = 0;
  let staleOrNever = 0;
  const byStore = new Map<string, number>();

  for (const device of input.devices) {
    byStore.set(device.store_id, (byStore.get(device.store_id) ?? 0) + 1);
    if (device.is_active) {
      active += 1;
      const seen = device.last_seen_at
        ? new Date(device.last_seen_at).getTime()
        : null;
      if (seen != null && !Number.isNaN(seen) && now - seen <= RECENT_MS) {
        seenRecently += 1;
      } else {
        staleOrNever += 1;
      }
    } else {
      inactive += 1;
    }
  }

  const byStoreChart = [...byStore.entries()]
    .map(([storeId, count]) => ({
      label: (input.storeNames[storeId] ?? "فرع").slice(0, 14),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    total: input.devices.length,
    active,
    inactive,
    seenRecently,
    staleOrNever,
    byStoreChart,
  };
}
