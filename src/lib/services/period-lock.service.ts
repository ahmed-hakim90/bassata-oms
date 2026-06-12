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

/** Monthly period locking was removed with CafeFlow legacy cleanup. */
export async function assertPeriodOpen(
  _storeId: string,
  _occurredAt?: string
): Promise<void> {
  return;
}
