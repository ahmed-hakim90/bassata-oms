/** Pure period comparison helpers — safe for client components. */

export interface PeriodDelta {
  current: number;
  previous: number;
  delta: number;
  /** Percent change; null when previous is 0. */
  deltaPct: number | null;
}

/** Pure: delta + percent vs previous period. */
export function computePeriodDelta(current: number, previous: number): PeriodDelta {
  const delta = current - previous;
  const deltaPct = previous === 0 ? (current === 0 ? 0 : null) : (delta / previous) * 100;
  return { current, previous, delta, deltaPct };
}

function formatDeltaPct(pct: number | null): string {
  if (pct === null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatPeriodDeltaLabel(delta: PeriodDelta): string {
  return formatDeltaPct(delta.deltaPct);
}
