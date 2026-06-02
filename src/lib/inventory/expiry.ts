import type { ShelfLifeUnit } from "@/lib/types";

export function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

export function calculateExpiryDate(
  productionDate: string | null | undefined,
  shelfLifeValue: number | null | undefined,
  shelfLifeUnit: ShelfLifeUnit | null | undefined
): string | null {
  const baseDate = toIsoDate(productionDate);
  if (!baseDate) return null;

  const value = Math.max(0, Math.trunc(shelfLifeValue ?? 0));
  if (value === 0) return baseDate;

  const date = new Date(baseDate);
  switch (shelfLifeUnit ?? "days") {
    case "years":
      date.setFullYear(date.getFullYear() + value);
      break;
    case "months":
      date.setMonth(date.getMonth() + value);
      break;
    default:
      date.setDate(date.getDate() + value);
      break;
  }

  return date.toISOString().slice(0, 10);
}
