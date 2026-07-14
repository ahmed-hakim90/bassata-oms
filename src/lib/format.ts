import { format, formatDistanceToNow } from "date-fns";

export function formatCurrency(
  amount: number,
  currency = "EGP",
  locale = "ar-EG",
  options?: { compact?: "egp-glyph" }
): string {
  if (options?.compact === "egp-glyph") {
    if (Number.isInteger(amount)) return `${amount} ج`;
    return `${Number(amount).toFixed(2)} ج`;
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    numberingSystem: "latn",
  }).format(amount);
}

export function formatDateTime(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return format(date, "MMM d, yyyy · h:mm a");
}

export function formatRelativeTime(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return formatDistanceToNow(date, { addSuffix: true });
}
