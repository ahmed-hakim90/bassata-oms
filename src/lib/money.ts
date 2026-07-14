/** Round to 2 decimal places (currency-safe for EGP-style money). */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
