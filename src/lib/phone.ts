/** Egypt-focused phone normalization for customer search/create. */

export function normalizeEgyptPhone(input: string): string {
  const raw = input.trim();
  if (!raw) return "";

  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;

  if (digits.startsWith("+20")) {
    digits = digits.slice(3);
  } else if (digits.startsWith("20") && digits.length >= 12) {
    digits = digits.slice(2);
  }

  digits = digits.replace(/\D/g, "");

  if (digits.startsWith("0") && digits.length === 11) {
    return digits;
  }
  if (digits.length === 10 && digits.startsWith("1")) {
    return `0${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `0${digits.slice(0, 10)}`;
  }

  // Preserve non-EG / incomplete input as trimmed original digits when possible
  if (digits.length >= 8) return digits.startsWith("0") ? digits : raw.replace(/\s+/g, "");
  return raw;
}

/** Digits-only form used for ILIKE search broadening. */
export function phoneSearchDigits(input: string): string {
  return normalizeEgyptPhone(input).replace(/\D/g, "");
}
