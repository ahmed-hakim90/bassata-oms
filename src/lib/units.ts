import type { MeasurementUnit } from "@/lib/types";

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
