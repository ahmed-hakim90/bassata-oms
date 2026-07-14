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

/** Metric families only — null when units are not convertible via convertUnit. */
export function tryConvertMetricUnit(
  qty: number,
  from: MeasurementUnit,
  to: MeasurementUnit
): number | null {
  if (from === to) return qty;
  if (
    (from === "kg" && to === "gram") ||
    (from === "gram" && to === "kg") ||
    (from === "liter" && to === "ml") ||
    (from === "ml" && to === "liter")
  ) {
    return convertUnit(qty, from, to);
  }
  return null;
}

export type PricingPacking = {
  baseUnit: MeasurementUnit;
  packUnit: MeasurementUnit;
  unitsPerPack: number;
};

/**
 * Convert qty between sale/tier units using metric pairs and optional purchase packing.
 * Returns null when conversion is impossible (never silent-pass pack mismatches).
 */
export function convertQuantityForPricing(input: {
  quantity: number;
  from: MeasurementUnit;
  to: MeasurementUnit;
  packing?: PricingPacking | null;
}): number | null {
  const { quantity, from, to, packing } = input;
  if (from === to) return quantity;

  const metric = tryConvertMetricUnit(quantity, from, to);
  if (metric != null) return metric;

  if (!packing) return null;
  const factor = Number(packing.unitsPerPack);
  if (!Number.isFinite(factor) || factor <= 0) return null;
  if (!isPurchasePackUnit(packing.packUnit) || packing.packUnit === packing.baseUnit) {
    return null;
  }

  const asBase = (unit: MeasurementUnit, qty: number): number | null => {
    if (unit === packing.baseUnit) return qty;
    const viaMetric = tryConvertMetricUnit(qty, unit, packing.baseUnit);
    if (viaMetric != null) return viaMetric;
    if (unit === packing.packUnit) return qty * factor;
    return null;
  };

  const fromBase = asBase(from, quantity);
  if (fromBase == null) return null;

  if (to === packing.baseUnit) return fromBase;
  const toMetric = tryConvertMetricUnit(fromBase, packing.baseUnit, to);
  if (toMetric != null) return toMetric;
  if (to === packing.packUnit) return fromBase / factor;
  return null;
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
    piece: "قطعة",
    pack: "علبة",
    carton: "كرتونة",
    box: "صندوق",
    meter: "متر",
    bag: "كيس",
    cup: "كوب",
    spoon: "معلقة",
    gram: "جرام",
    kg: "كيلو",
    ml: "مل",
    liter: "لتر",
  };
  return labels[unit];
}

export function formatUnitShort(unit: MeasurementUnit): string {
  const labels: Record<MeasurementUnit, string> = {
    piece: "ق",
    pack: "علبة",
    carton: "كرت",
    box: "صندوق",
    meter: "م",
    bag: "كيس",
    cup: "كوب",
    spoon: "معلقة",
    gram: "ج",
    kg: "كجم",
    ml: "مل",
    liter: "ل",
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
  const qtyLabel = `${qty} ${formatUnitShort(unit)}`;
  return `${qtyLabel} × ${formatCurrency(unitPrice)}/${formatUnitShort(unit)} = ${formatCurrency(total, currency)}`;
}

export function isWeightUnit(unit: MeasurementUnit): boolean {
  return unit === "kg" || unit === "gram";
}

/** Packaging units typically used for purchase invoices (cartons/packs/bags). */
export const PURCHASE_PACK_UNITS: MeasurementUnit[] = ["carton", "pack", "box", "bag"];

type PurchasePackProduct = {
  cost_unit: MeasurementUnit;
  base_unit?: MeasurementUnit;
  unit: MeasurementUnit;
  units_per_purchase_unit?: number;
};

export function isPurchasePackUnit(unit: MeasurementUnit): boolean {
  return (PURCHASE_PACK_UNITS as readonly MeasurementUnit[]).includes(unit);
}

export function productPurchaseFactor(product: PurchasePackProduct): number {
  const factor = Number(product.units_per_purchase_unit ?? 1);
  return Number.isFinite(factor) && factor > 0 ? factor : 1;
}

export function productHasPurchasePacking(product: PurchasePackProduct): boolean {
  const base = product.base_unit ?? product.unit;
  return (
    isPurchasePackUnit(product.cost_unit) &&
    product.cost_unit !== base &&
    productPurchaseFactor(product) > 0
  );
}

export function productPackingForPricing(
  product: PurchasePackProduct
): PricingPacking | null {
  if (!productHasPurchasePacking(product)) return null;
  return {
    baseUnit: product.base_unit ?? product.unit,
    packUnit: product.cost_unit,
    unitsPerPack: productPurchaseFactor(product),
  };
}

/**
 * Convert a purchase line entry (piece or carton) into base-unit qty + unit cost.
 * Stock and purchase_invoice_lines always persist in base units.
 * Factor may be fractional (e.g. carton = 2.5 kg).
 */
export function convertPurchaseEntryToBase(input: {
  quantity: number;
  unitCost: number;
  entryUnit: MeasurementUnit;
  baseUnit: MeasurementUnit;
  purchaseUnit: MeasurementUnit;
  unitsPerPurchaseUnit: number;
}): { quantity: number; unitCost: number; lineTotal: number } {
  const qty = input.quantity;
  const cost = input.unitCost;
  const factor =
    Number.isFinite(input.unitsPerPurchaseUnit) && input.unitsPerPurchaseUnit > 0
      ? input.unitsPerPurchaseUnit
      : 1;

  if (
    input.entryUnit === input.baseUnit ||
    input.purchaseUnit === input.baseUnit ||
    !isPurchasePackUnit(input.purchaseUnit)
  ) {
    const lineTotal = Number((qty * cost).toFixed(2));
    return { quantity: qty, unitCost: cost, lineTotal };
  }

  if (input.entryUnit === input.purchaseUnit) {
    const baseQty = Number((qty * factor).toFixed(4));
    const baseCost = Number((cost / factor).toFixed(4));
    const lineTotal = Number((qty * cost).toFixed(2));
    return { quantity: baseQty, unitCost: baseCost, lineTotal };
  }

  throw new Error("وحدة الشراء غير مدعومة لهذا الصنف");
}
