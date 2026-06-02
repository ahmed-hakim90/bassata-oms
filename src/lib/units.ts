import type { MeasurementUnit } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

export function convertUnit(
  qty: number,
  from: MeasurementUnit,
  to: MeasurementUnit
): number {
  if (from === to) return qty;
  if (from === "kg" && to === "gram") return qty * 1000;
  if (from === "gram" && to === "kg") return qty / 1000;
  if (from === "liter" && to === "ml") return qty * 1000;
  if (from === "ml" && to === "liter") return qty / 1000;
  return qty;
}

export function normalizeToBaseUnit(
  qty: number,
  from: MeasurementUnit,
  baseUnit: MeasurementUnit
): number {
  return convertUnit(qty, from, baseUnit);
}

export function quantityFromAmount(amount: number, unitPricePerSaleUnit: number): number {
  if (unitPricePerSaleUnit <= 0) return 0;
  return Math.round((amount / unitPricePerSaleUnit) * 10000) / 10000;
}

export function amountFromQuantity(quantity: number, unitPricePerSaleUnit: number): number {
  return Math.round(quantity * unitPricePerSaleUnit * 100) / 100;
}

export function formatUnit(unit: MeasurementUnit): string {
  const labels: Record<MeasurementUnit, string> = {
    piece: "Piece",
    bag: "Bag",
    cup: "Cup",
    spoon: "Spoon",
    gram: "Gram",
    kg: "Kg",
    ml: "ml",
    liter: "Liter",
  };
  return labels[unit];
}

export function formatUnitShort(unit: MeasurementUnit): string {
  const labels: Record<MeasurementUnit, string> = {
    piece: "pc",
    bag: "bag",
    cup: "cup",
    spoon: "sp",
    gram: "g",
    kg: "kg",
    ml: "ml",
    liter: "L",
  };
  return labels[unit];
}

export function formatQuantityLine(
  qty: number,
  unit: MeasurementUnit,
  unitPrice: number,
  total: number,
  currency = "EGP"
): string {
  const qtyLabel = unit === "piece" ? `${qty} ${formatUnitShort(unit)}` : `${qty} ${formatUnitShort(unit)}`;
  return `${qtyLabel} × ${formatCurrency(unitPrice)}/${formatUnitShort(unit)} = ${formatCurrency(total, currency)}`;
}

export function isWeightUnit(unit: MeasurementUnit): boolean {
  return unit === "kg" || unit === "gram";
}
