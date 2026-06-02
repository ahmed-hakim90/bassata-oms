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

export async function assertPeriodOpen(storeId: string, occurredAt?: string): Promise<void> {
  const at = occurredAt ?? new Date().toISOString();
  const closed = await inventoryRepo.isPeriodClosed(storeId, at);
  if (closed) {
    const period = await closingRepo.findClosedPeriod(storeId, at);
    throw new PeriodClosedError(
      `Operations are blocked: period ${period?.period_start ?? ""} – ${period?.period_end ?? ""} is closed.`,
      period?.period_start,
      period?.period_end
    );
  }
}
