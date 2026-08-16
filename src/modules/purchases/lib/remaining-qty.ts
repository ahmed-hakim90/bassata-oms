export function remainingPurchaseLineQty(ordered: number, allocated: number): number {
  return Math.max(0, Number((ordered - allocated).toFixed(4)));
}
