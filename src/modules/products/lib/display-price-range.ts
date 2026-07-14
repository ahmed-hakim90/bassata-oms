import { formatCurrency } from "@/lib/format";

export type DisplayPriceRange = {
  /** Lowest amount to show as the primary price. */
  amount: number;
  /** Suffix like " إلى X" or " – X" when there is a range; empty otherwise. */
  rangeLabel: string;
};

/**
 * Resolve display amount + optional range from variant prices and a base fallback.
 * Shared by POS tiles, catalog grid, and online menu.
 */
export function resolveDisplayPriceRange(input: {
  variantPrices: number[];
  baseAmount: number;
  currency?: string;
  /** When false, still use min variant as amount if present but skip the range label. */
  showRange?: boolean;
  rangeSeparator?: "arabic" | "en-dash";
}): DisplayPriceRange {
  const prices = input.variantPrices
    .filter((price) => Number.isFinite(price))
    .sort((a, b) => a - b);
  const min = prices[0];
  const max = prices.at(-1);
  const hasVariants = min != null && max != null;
  const showRange = input.showRange !== false;
  const amount = hasVariants ? min : input.baseAmount;
  const currency = input.currency ?? "EGP";
  const sep = input.rangeSeparator === "en-dash" ? " – " : " إلى ";

  if (showRange && hasVariants && max > min) {
    return {
      amount,
      rangeLabel: `${sep}${formatCurrency(max, currency)}`,
    };
  }
  return { amount, rangeLabel: "" };
}
