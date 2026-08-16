import type { Category, MeasurementUnit, Product } from "@/lib/types";

/** Bound printed rows so a huge catalog cannot stall the print surface. */
export const COUNT_SHEET_MAX_ROWS = 500;

export interface CountSheetFilters {
  categoryId?: string;
  productId?: string;
}

export interface CountSheetLine {
  productId: string;
  name: string;
  sku: string;
  barcode: string;
  unit: MeasurementUnit;
  categoryId: string;
  categoryName: string;
  expectedQty: number;
  countedQty: number | null;
  variance: number | null;
}

export interface CountSheetGroup {
  categoryId: string;
  categoryName: string;
  lines: CountSheetLine[];
}

export function filterTrackedProducts(
  products: readonly Product[],
  filters: CountSheetFilters,
  options?: { trackedOnly?: boolean }
): Product[] {
  const trackedOnly = options?.trackedOnly ?? true;
  return products.filter((product) => {
    if (trackedOnly && !product.track_inventory) return false;
    if (filters.productId && product.id !== filters.productId) return false;
    if (filters.categoryId && product.category_id !== filters.categoryId) {
      return false;
    }
    return true;
  });
}

export function buildCountSheetLines(input: {
  products: readonly Product[];
  categories: readonly Category[];
  qtyByProductId: ReadonlyMap<string, number>;
  filters: CountSheetFilters;
  /** When true, counted stays empty for handwriting on paper. */
  blankCounted?: boolean;
  countedByProductId?: ReadonlyMap<string, number>;
  trackedOnly?: boolean;
}): { lines: CountSheetLine[]; truncated: boolean } {
  const categoryNameById = new Map(
    input.categories.map((category) => [category.id, category.name])
  );
  const tracked = filterTrackedProducts(
    input.products,
    input.filters,
    { trackedOnly: input.trackedOnly ?? true }
  ).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  const truncated = tracked.length > COUNT_SHEET_MAX_ROWS;
  const slice = truncated ? tracked.slice(0, COUNT_SHEET_MAX_ROWS) : tracked;

  const lines = slice.map((product) => {
    const expectedQty = input.qtyByProductId.get(product.id) ?? 0;
    const countedQty = input.blankCounted
      ? null
      : (input.countedByProductId?.get(product.id) ?? expectedQty);
    const variance =
      countedQty == null ? null : countedQty - expectedQty;
    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      unit: product.unit,
      categoryId: product.category_id || "uncategorized",
      categoryName:
        categoryNameById.get(product.category_id) ?? "بدون قسم",
      expectedQty,
      countedQty,
      variance,
    };
  });

  return { lines, truncated };
}

export function groupCountSheetLines(lines: CountSheetLine[]): CountSheetGroup[] {
  const groups = new Map<string, CountSheetGroup>();
  for (const line of lines) {
    const existing = groups.get(line.categoryId);
    if (existing) {
      existing.lines.push(line);
      continue;
    }
    groups.set(line.categoryId, {
      categoryId: line.categoryId,
      categoryName: line.categoryName,
      lines: [line],
    });
  }
  return [...groups.values()].sort((a, b) =>
    a.categoryName.localeCompare(b.categoryName, "ar")
  );
}

export function countSheetTotals(lines: CountSheetLine[]): {
  products: number;
  systemUnits: number;
  countedUnits: number | null;
  varianceUnits: number | null;
} {
  let systemUnits = 0;
  let countedUnits = 0;
  let varianceUnits = 0;
  let hasCounted = false;
  for (const line of lines) {
    systemUnits += line.expectedQty;
    if (line.countedQty != null) {
      hasCounted = true;
      countedUnits += line.countedQty;
    }
    if (line.variance != null) varianceUnits += line.variance;
  }
  return {
    products: lines.length,
    systemUnits,
    countedUnits: hasCounted ? countedUnits : null,
    varianceUnits: hasCounted ? varianceUnits : null,
  };
}

export function qtyByProductIdFromLevels(
  levels: readonly { product_id: string; variant_id: string | null; quantity: number }[]
): Map<string, number> {
  const qtyByProductId = new Map<string, number>();
  for (const level of levels) {
    if (level.variant_id) continue;
    qtyByProductId.set(
      level.product_id,
      (qtyByProductId.get(level.product_id) ?? 0) + level.quantity
    );
  }
  return qtyByProductId;
}
