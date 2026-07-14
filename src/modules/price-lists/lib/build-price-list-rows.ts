import {
  formatUnit,
  productHasPurchasePacking,
  productPurchaseFactor,
} from "@/lib/units";
import { roundMoney } from "@/lib/money";
import type { Product, PurchaseInvoiceLine } from "@/lib/types";

export { roundMoney } from "@/lib/money";

export type PriceListRow = {
  id: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  /** Cost of one purchase pack (carton/pack) or of the base unit when no packing. */
  packCost: number;
  packUnitLabel: string;
  /** e.g. "24 قطعة" under the product name */
  weightLine: string;
  hasPacking: boolean;
  /** Suggested selling price (before inventory override). */
  suggestedSalePrice: number;
  /** Selling price shown on the list (may be manually overridden). */
  salePrice: number;
  /** Catalog unit selling price (sale_price ?? base_price). */
  catalogSalePrice: number;
};

export function suggestSaleFromCost(packCost: number, marginPercent: number): number {
  const margin = Number.isFinite(marginPercent) ? marginPercent : 0;
  return roundMoney(packCost * (1 + margin / 100));
}

export function applyDisplayDiscount(salePrice: number, discountPercent: number): number {
  const d = Number.isFinite(discountPercent) ? Math.max(0, discountPercent) : 0;
  if (d <= 0) return roundMoney(salePrice);
  return roundMoney(salePrice * (1 - d / 100));
}

export function computePackCost(
  product: Product,
  unitCost: number,
  landedUnitCost?: number | null
): number {
  const baseCost = landedUnitCost != null && landedUnitCost > 0 ? landedUnitCost : unitCost;
  if (!productHasPurchasePacking(product)) {
    return roundMoney(baseCost);
  }
  return roundMoney(baseCost * productPurchaseFactor(product));
}

/** Catalog selling price for the product's sale unit (قطعة / كيلو…). */
export function catalogUnitSalePrice(product: Product): number {
  return roundMoney(product.sale_price ?? product.base_price ?? 0);
}

/**
 * Selling price for the price list.
 * Prefer catalog سعر البيع; if missing, fall back to cost + margin on the purchase pack.
 */
export function suggestListSalePrice(
  product: Product,
  packCost: number,
  marginPercent: number
): number {
  const catalog = catalogUnitSalePrice(product);
  if (catalog > 0) return catalog;
  return suggestSaleFromCost(packCost, marginPercent);
}

function weightLineFor(product: Product): string {
  if (!productHasPurchasePacking(product)) return "";
  const factor = productPurchaseFactor(product);
  const base = product.base_unit ?? product.unit;
  const label = formatUnit(base);
  return `${factor} ${label}`;
}

function packUnitLabelFor(product: Product): string {
  // Price list shows selling unit, not purchase carton — unless no distinct sale unit.
  return formatUnit(product.sale_unit ?? product.base_unit ?? product.unit);
}

export function buildPriceListRowFromCost(input: {
  id: string;
  product: Product;
  unitCost: number;
  landedUnitCost?: number | null;
  marginPercent: number;
  salePriceOverride?: number | null;
}): PriceListRow {
  const { product, marginPercent } = input;
  const packCost = computePackCost(product, input.unitCost, input.landedUnitCost);
  const catalogSalePrice = catalogUnitSalePrice(product);
  const suggestedSalePrice = suggestListSalePrice(product, packCost, marginPercent);
  const salePrice =
    input.salePriceOverride != null && Number.isFinite(input.salePriceOverride)
      ? roundMoney(input.salePriceOverride)
      : suggestedSalePrice;

  return {
    id: input.id,
    productId: product.id,
    name: product.name,
    imageUrl: product.image_url,
    packCost,
    packUnitLabel: packUnitLabelFor(product),
    weightLine: weightLineFor(product),
    hasPacking: productHasPurchasePacking(product),
    suggestedSalePrice,
    salePrice,
    catalogSalePrice,
  };
}

export function buildRowsFromPurchaseLines(input: {
  lines: PurchaseInvoiceLine[];
  productsById: Map<string, Product>;
  marginPercent: number;
}): PriceListRow[] {
  const rows: PriceListRow[] = [];
  for (const line of input.lines) {
    const product = input.productsById.get(line.product_id);
    if (!product) continue;
    rows.push(
      buildPriceListRowFromCost({
        id: line.id,
        product,
        unitCost: line.unit_cost,
        landedUnitCost: line.landed_unit_cost,
        marginPercent: input.marginPercent,
      })
    );
  }
  return rows;
}

export function buildRowsFromProducts(input: {
  products: Product[];
  marginPercent: number;
}): PriceListRow[] {
  return input.products.map((product) =>
    buildPriceListRowFromCost({
      id: product.id,
      product,
      unitCost: product.last_unit_cost,
      landedUnitCost: product.last_unit_cost,
      marginPercent: input.marginPercent,
    })
  );
}

/**
 * Recompute suggestions when margin changes.
 * Rows that already have a catalog selling price keep that price unless manually edited.
 * Cost+margin fallback rows update with the new margin.
 */
export function reapplyMargin(
  rows: PriceListRow[],
  marginPercent: number,
  manuallyEditedIds: Set<string>
): PriceListRow[] {
  return rows.map((row) => {
    const suggestedSalePrice =
      row.catalogSalePrice > 0
        ? row.catalogSalePrice
        : suggestSaleFromCost(row.packCost, marginPercent);
    if (manuallyEditedIds.has(row.id)) {
      return { ...row, suggestedSalePrice };
    }
    return { ...row, suggestedSalePrice, salePrice: suggestedSalePrice };
  });
}
