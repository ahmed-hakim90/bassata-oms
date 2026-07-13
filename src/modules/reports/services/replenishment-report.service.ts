import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as recipeRepo from "@/lib/repositories/recipe.repository";
import { getDb } from "@/lib/repositories/client";
import { convertUnit, formatUnit } from "@/lib/units";
import type { MeasurementUnit, Product, ProductRecipeLine } from "@/lib/types";

export interface ReplenishmentRow {
  productId: string;
  productName: string;
  sku: string;
  unit: MeasurementUnit;
  unitLabel: string;
  /** Consumed / sold in the selected calendar month (stock unit). */
  monthUsage: number;
  /** monthUsage × coverageMonths */
  requiredQty: number;
  onHand: number;
  /** max(0, requiredQty − onHand) */
  suggestedBuy: number;
  /** Days the on-hand covers at this month's daily rate; null if no usage. */
  daysCover: number | null;
  source: "ingredient" | "product";
}

export interface ReplenishmentReport {
  month: string;
  monthLabel: string;
  fromIso: string;
  toIso: string;
  daysInMonth: number;
  coverageMonths: 1 | 2 | 3;
  orderCount: number;
  rows: ReplenishmentRow[];
  summary: {
    skuCount: number;
    needBuyCount: number;
    totalSuggestedBuyLines: number;
  };
}

export function resolveCalendarMonth(monthParam?: string): {
  month: string;
  year: number;
  monthIndex: number;
  from: Date;
  to: Date;
  daysInMonth: number;
  monthLabel: string;
} {
  const now = new Date();
  let year: number;
  let monthIndex: number;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    year = Number(monthParam.slice(0, 4));
    monthIndex = Number(monthParam.slice(5, 7)) - 1;
  } else {
    // Default: previous full calendar month (complete sales window).
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    year = prev.getFullYear();
    monthIndex = prev.getMonth();
  }
  const from = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const to = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  const daysInMonth = to.getDate();
  const month = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const monthLabel = from.toLocaleDateString("ar-EG", {
    month: "long",
    year: "numeric",
  });
  return { month, year, monthIndex, from, to, daysInMonth, monthLabel };
}

export function parseCoverageMonths(raw?: string | number): 1 | 2 | 3 {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 1;
}

function soldQty(item: {
  quantity: number;
  base_quantity?: number | null;
}): number {
  const base = item.base_quantity;
  if (base != null && Number.isFinite(Number(base)) && Number(base) > 0) {
    return Number(base);
  }
  return Number(item.quantity) || 0;
}

function recipeLinesForItem(
  recipes: Map<string, ProductRecipeLine[]>,
  productId: string,
  variantId: string | null
): ProductRecipeLine[] {
  const variantKey = `${productId}:${variantId ?? ""}`;
  const baseKey = `${productId}:`;
  const variantLines = recipes.get(variantKey);
  if (variantLines && variantLines.length > 0) return variantLines;
  return recipes.get(baseKey) ?? [];
}

/**
 * Inventory buy plan from one calendar month of completed sales.
 * Explodes finished goods through recipes into ingredients; tracked
 * products without a recipe count as themselves.
 */
export async function getReplenishmentReport(options: {
  storeId?: string;
  month?: string;
  coverageMonths?: 1 | 2 | 3;
}): Promise<ReplenishmentReport> {
  const calendar = resolveCalendarMonth(options.month);
  const coverageMonths = options.coverageMonths ?? 1;
  const fromIso = calendar.from.toISOString();
  const toIso = calendar.to.toISOString();

  const [orders, products, recipes, stockLevels] = await Promise.all([
    orderRepo.listOrders({
      storeId: options.storeId,
      status: "completed",
      from: fromIso,
      to: toIso,
    }),
    catalogRepo.listProducts(),
    recipeRepo.listAllRecipeLinesByProductKey(),
    options.storeId
      ? inventoryRepo.listStockLevels(options.storeId)
      : inventoryRepo.listStockLevels(),
  ]);

  const paidOrders = orders.filter((o) => o.payment_status !== "unpaid");
  const productMap = new Map(products.map((p) => [p.id, p]));
  const usage = new Map<string, { qty: number; source: "ingredient" | "product" }>();

  const addUsage = (
    productId: string,
    qty: number,
    source: "ingredient" | "product"
  ) => {
    if (qty <= 0) return;
    const existing = usage.get(productId);
    if (existing) {
      existing.qty += qty;
    } else {
      usage.set(productId, { qty, source });
    }
  };

  const db = await getDb();
  const orderIds = paidOrders.map((o) => o.id);
  const { data: rawItems } =
    orderIds.length > 0
      ? await db.from("order_items").select("*").in("order_id", orderIds)
      : { data: [] };

  for (const item of rawItems ?? []) {
    const qty = soldQty(item);
    if (qty <= 0) continue;
    const productId = String(item.product_id);
    const variantId = item.variant_id ? String(item.variant_id) : null;
    const lines = recipeLinesForItem(recipes, productId, variantId);

    if (lines.length > 0) {
      for (const line of lines) {
        const ingredient = productMap.get(line.ingredient_product_id);
        const stockUnit =
          (ingredient?.base_unit ?? ingredient?.unit ?? line.unit) as MeasurementUnit;
        const lineQty = convertUnit(line.quantity, line.unit, stockUnit) * qty;
        addUsage(line.ingredient_product_id, lineQty, "ingredient");
      }
      continue;
    }

    const product = productMap.get(productId);
    if (!product?.track_inventory) continue;
    const stockUnit = (product.base_unit ?? product.unit) as MeasurementUnit;
    const saleUnit = (item.sale_unit ?? product.sale_unit ?? product.unit) as MeasurementUnit;
    addUsage(productId, convertUnit(qty, saleUnit, stockUnit), "product");
  }

  const onHandByProduct = new Map<string, number>();
  for (const level of stockLevels) {
    if (options.storeId && level.store_id !== options.storeId) continue;
    onHandByProduct.set(
      level.product_id,
      (onHandByProduct.get(level.product_id) ?? 0) + level.quantity
    );
  }

  const dailyDivisor = Math.max(1, calendar.daysInMonth);
  const rows: ReplenishmentRow[] = [];

  for (const [productId, { qty: monthUsage, source }] of usage) {
    const product: Product | undefined = productMap.get(productId);
    const unit = (product?.base_unit ?? product?.unit ?? "piece") as MeasurementUnit;
    const onHand = onHandByProduct.get(productId) ?? 0;
    const requiredQty = Number((monthUsage * coverageMonths).toFixed(4));
    const suggestedBuy = Number(Math.max(0, requiredQty - onHand).toFixed(4));
    const daysCover =
      monthUsage > 0
        ? Number(((onHand / (monthUsage / dailyDivisor))).toFixed(1))
        : null;

    rows.push({
      productId,
      productName: product?.name ?? "—",
      sku: product?.sku ?? "",
      unit,
      unitLabel: formatUnit(unit),
      monthUsage: Number(monthUsage.toFixed(4)),
      requiredQty,
      onHand: Number(onHand.toFixed(4)),
      suggestedBuy,
      daysCover,
      source,
    });
  }

  rows.sort((a, b) => {
    if (b.suggestedBuy !== a.suggestedBuy) return b.suggestedBuy - a.suggestedBuy;
    return a.productName.localeCompare(b.productName, "ar");
  });

  return {
    month: calendar.month,
    monthLabel: calendar.monthLabel,
    fromIso,
    toIso,
    daysInMonth: calendar.daysInMonth,
    coverageMonths,
    orderCount: paidOrders.length,
    rows,
    summary: {
      skuCount: rows.length,
      needBuyCount: rows.filter((r) => r.suggestedBuy > 0).length,
      totalSuggestedBuyLines: rows.filter((r) => r.suggestedBuy > 0).length,
    },
  };
}
