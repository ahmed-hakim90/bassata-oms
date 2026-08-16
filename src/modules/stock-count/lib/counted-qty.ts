/** Physical count qty — never negative, never NaN. */
export function clampCountedQty(qty: number): number {
  if (!Number.isFinite(qty)) return 0;
  return Math.max(0, qty);
}

export function nextCountedQty(current: number, delta: number): number {
  return clampCountedQty(current + delta);
}

/** Only empty in-progress counts are healed — scoped counts must not grow to the full catalog. */
export function shouldHealEmptyCountLines(existingLineCount: number): boolean {
  return existingLineCount === 0;
}

export function openingCountedQty(
  expectedQty: number,
  countFromZero: boolean
): { countedQty: number; variance: number } {
  if (countFromZero) {
    return { countedQty: 0, variance: -expectedQty };
  }
  return { countedQty: expectedQty, variance: 0 };
}
