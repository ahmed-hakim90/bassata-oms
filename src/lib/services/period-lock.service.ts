import * as closingRepo from "@/lib/repositories/closing.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";

export class PeriodClosedError extends Error {
  constructor(
    message: string,
    public periodStart?: string,
    public periodEnd?: string
  ) {
    super(message);
    this.name = "PeriodClosedError";
  }
}

/** Block mutations when the store date falls inside a closed monthly period. */
export async function assertPeriodOpen(storeId: string, occurredAt?: string): Promise<void> {
  const at = occurredAt ?? new Date().toISOString();
  const closed = await inventoryRepo.isPeriodClosed(storeId, at);
  if (!closed) return;

  const period = await closingRepo.findClosedPeriod(storeId, at);
  throw new PeriodClosedError(
    `الفترة مقفولة (${period?.period_start ?? "?"} – ${period?.period_end ?? "?"}) — مش هتقدر تعدّل على التاريخ ده.`,
    period?.period_start,
    period?.period_end
  );
}
