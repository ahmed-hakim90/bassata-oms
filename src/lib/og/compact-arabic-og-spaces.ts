/**
 * Tighten Arabic conjunction spacing for Satori (avoids a lonely "و" gap).
 */
export function compactArabicOgSpaces(value: string): string {
  return value
    .replace(/\s+و\s+/g, " و")
    .replace(/\s+/g, " ")
    .trim();
}
