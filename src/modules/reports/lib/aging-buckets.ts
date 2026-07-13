/** Shared AR/AP aging bucket helpers (S15 basics). */

export type AgingBucketKey = "current" | "days30" | "days60" | "days90" | "over90";

export interface AgingBuckets {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  [key: string]: number;
}

export function emptyAgingBuckets(): AgingBuckets {
  return { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
}

/** Map days outstanding → bucket (0–30 current, 31–60, 61–90, 91–120, 120+). */
export function bucketForDaysOutstanding(days: number): AgingBucketKey {
  if (days <= 30) return "current";
  if (days <= 60) return "days30";
  if (days <= 90) return "days60";
  if (days <= 120) return "days90";
  return "over90";
}

export function daysBetween(fromIso: string, toMs = Date.now()): number {
  const from = new Date(fromIso).getTime();
  if (Number.isNaN(from)) return 0;
  return Math.max(0, Math.floor((toMs - from) / (86400 * 1000)));
}

export function addToBucket(buckets: AgingBuckets, key: AgingBucketKey, amount: number): void {
  buckets[key] += amount;
}

/**
 * Allocate an outstanding balance across dated debit events (oldest first).
 * Payments reduce oldest open amounts — basic FIFO for aging "basics".
 */
export function allocateBalanceToAgedDebits(
  balance: number,
  debitEvents: { at: string; amount: number }[],
  nowMs = Date.now()
): { buckets: AgingBuckets; oldestAt: string | null; daysOutstanding: number } {
  const buckets = emptyAgingBuckets();
  if (balance <= 0 || debitEvents.length === 0) {
    return { buckets, oldestAt: null, daysOutstanding: 0 };
  }

  const sorted = [...debitEvents]
    .filter((e) => e.amount > 0)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  let remaining = balance;
  let oldestAt: string | null = null;
  for (const event of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, event.amount);
    if (take <= 0) continue;
    if (!oldestAt) oldestAt = event.at;
    const days = daysBetween(event.at, nowMs);
    addToBucket(buckets, bucketForDaysOutstanding(days), take);
    remaining -= take;
  }

  if (remaining > 0) {
    const fallbackAt = oldestAt ?? sorted[0]?.at ?? new Date(nowMs).toISOString();
    addToBucket(buckets, bucketForDaysOutstanding(daysBetween(fallbackAt, nowMs)), remaining);
    oldestAt = oldestAt ?? fallbackAt;
  }

  return {
    buckets,
    oldestAt,
    daysOutstanding: oldestAt ? daysBetween(oldestAt, nowMs) : 0,
  };
}

export function sumBuckets(buckets: AgingBuckets): number {
  return (
    buckets.current +
    buckets.days30 +
    buckets.days60 +
    buckets.days90 +
    buckets.over90
  );
}

export function mergeBuckets(into: AgingBuckets, from: AgingBuckets): void {
  into.current += from.current;
  into.days30 += from.days30;
  into.days60 += from.days60;
  into.days90 += from.days90;
  into.over90 += from.over90;
}
