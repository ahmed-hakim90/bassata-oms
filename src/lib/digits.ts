/**
 * Normalize Eastern Arabic (٠-٩) and Persian (۰-۹) digits to Western (0-9).
 */
export function toWesternDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    // Arabic-Indic: U+0660–U+0669
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    // Extended Arabic-Indic (Persian): U+06F0–U+06F9
    if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
    return digit;
  });
}

/** Keep a typed decimal: western digits + optional single `.` (Arabic `٫` → `.`). */
export function sanitizeDecimalInput(raw: string): string {
  const normalized = toWesternDigits(raw).replace(/٫/g, ".").replace(/,/g, ".");
  let result = "";
  let sawDot = false;
  for (const ch of normalized) {
    if (ch >= "0" && ch <= "9") {
      result += ch;
      continue;
    }
    if (ch === "." && !sawDot) {
      result += ".";
      sawDot = true;
    }
  }
  return result;
}

/** Western digits only (PIN, integer qty, etc.). */
export function sanitizeIntegerInput(raw: string): string {
  return toWesternDigits(raw).replace(/\D/g, "");
}

export function isNumericInputMode(
  type?: string,
  inputMode?: string
): boolean {
  return type === "number" || inputMode === "decimal" || inputMode === "numeric";
}

export function normalizeNumericInputValue(
  raw: string,
  type?: string,
  inputMode?: string
): string {
  if (type === "number" || inputMode === "decimal") {
    return sanitizeDecimalInput(raw);
  }
  if (inputMode === "numeric") {
    return sanitizeIntegerInput(raw);
  }
  return toWesternDigits(raw);
}
