export function requiresManagerDiscountOverride(
  discountAmount: number,
  threshold: number | null
) {
  return threshold !== null && discountAmount > threshold;
}
