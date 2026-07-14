import { roundMoney } from "@/lib/money";

export interface CostCorrectionLineInput {
  id: string;
  product_id: string;
  quantity: number;
  base_quantity: number | null;
  unit_cost: number;
  line_cost: number;
}

export interface CostCorrectionProductCost {
  /** Cost per base/stock unit (products.last_unit_cost). */
  last_unit_cost: number;
  /**
   * When set, preferred over last_unit_cost — finished product recipe cost
   * for one sale quantity unit (matches deliver_sales_invoice recipe path).
   */
  recipe_unit_cost?: number | null;
}

export interface CostCorrectionLineResult {
  lineId: string;
  productId: string;
  previousUnitCost: number;
  previousLineCost: number;
  unitCost: number;
  lineCost: number;
  changed: boolean;
}

/**
 * Same formula as deliver_sales_invoice for tracked (non-recipe) lines:
 * line_cost = round(unit_cost × base_qty, 2).
 * Recipe path stores unit_cost per sale qty and line_cost = unit_cost × quantity.
 */
export function resolveCorrectedLineCost(input: {
  quantity: number;
  baseQuantity: number | null;
  lastUnitCost: number;
  recipeUnitCost?: number | null;
}): { unitCost: number; lineCost: number } {
  const qty = Number(input.quantity) || 0;
  const baseQty =
    input.baseQuantity != null && Number(input.baseQuantity) !== 0
      ? Number(input.baseQuantity)
      : qty;

  if (input.recipeUnitCost != null && Number.isFinite(input.recipeUnitCost)) {
    const unitCost = Math.round(Number(input.recipeUnitCost) * 10000) / 10000;
    const lineCost = roundMoney(unitCost * qty);
    return { unitCost, lineCost };
  }

  const unitCost = Math.max(0, Number(input.lastUnitCost) || 0);
  const lineCost = roundMoney(unitCost * baseQty);
  return { unitCost, lineCost };
}

export function buildSalesInvoiceCostCorrections(
  lines: CostCorrectionLineInput[],
  productCostById: Map<string, CostCorrectionProductCost>
): CostCorrectionLineResult[] {
  return lines.map((line) => {
    const product = productCostById.get(line.product_id);
    const resolved = resolveCorrectedLineCost({
      quantity: line.quantity,
      baseQuantity: line.base_quantity,
      lastUnitCost: product?.last_unit_cost ?? 0,
      recipeUnitCost: product?.recipe_unit_cost,
    });
    const previousUnitCost = Number(line.unit_cost) || 0;
    const previousLineCost = Number(line.line_cost) || 0;
    const changed =
      Math.abs(previousUnitCost - resolved.unitCost) > 0.00005 ||
      Math.abs(previousLineCost - resolved.lineCost) > 0.005;
    return {
      lineId: line.id,
      productId: line.product_id,
      previousUnitCost,
      previousLineCost,
      unitCost: resolved.unitCost,
      lineCost: resolved.lineCost,
      changed,
    };
  });
}

export function summarizeCostCorrections(rows: CostCorrectionLineResult[]): {
  previousTotal: number;
  nextTotal: number;
  changedLines: number;
} {
  return {
    previousTotal: roundMoney(
      rows.reduce((sum, row) => sum + row.previousLineCost, 0)
    ),
    nextTotal: roundMoney(rows.reduce((sum, row) => sum + row.lineCost, 0)),
    changedLines: rows.filter((row) => row.changed).length,
  };
}
