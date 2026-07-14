import * as orderRepo from "@/lib/repositories/order.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as customerRepo from "@/lib/repositories/customer.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import * as recipeRepo from "@/lib/repositories/recipe.repository";
import { getDb, throwDbError } from "@/lib/repositories/client";
import { getOrgId } from "@/lib/repositories/organization.repository";
import {
  documentDateToOccurredAt,
  normalizeDocumentDate,
  todayDocumentDate,
} from "@/lib/document-date";
import { writeAuditLog } from "@/lib/services/audit.service";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import { productPackingForPricing } from "@/lib/units";
import { listPriceTiers, resolveUnitPrice } from "@/modules/products/services/pricing-tier.service";
import {
  getBusinessActivitySettings,
  getFeatureFlags,
  getSetting,
} from "@/modules/system/services/settings.service";
import { evaluateCartPromotions } from "@/modules/promotions/services/promotion.service";
import {
  buildSalesInvoiceCostCorrections,
  summarizeCostCorrections,
  type CostCorrectionLineResult,
  type CostCorrectionProductCost,
} from "@/modules/sales-invoices/lib/correct-line-costs";
import type {
  AppUser,
  Customer,
  Order,
  OrderItem,
  PaymentMethod,
  PaymentSplit,
  Product,
  SalesDocumentStatus,
  Warehouse,
} from "@/lib/types";

export interface SalesInvoiceLineWithName extends OrderItem {
  productName: string;
}

export interface SalesInvoiceWithDetails extends Order {
  lines: SalesInvoiceLineWithName[];
  customerName: string | null;
  warehouseName: string | null;
}

async function applyPromotionsToSalesInvoiceDraft(
  orderId: string,
  options?: {
    taxRate?: number;
    order?: Order;
    items?: OrderItem[];
    /** Skip feature-flag fetch when caller already checked. */
    promotionsEnabled?: boolean;
  }
): Promise<void> {
  const promotionsEnabled =
    options?.promotionsEnabled ?? (await getFeatureFlags()).promotions;
  if (!promotionsEnabled) return;

  const order = options?.order ?? (await orderRepo.getOrder(orderId));
  if (!order) return;
  const items = options?.items ?? (await orderRepo.getOrderItems(orderId));
  const taxRate = options?.taxRate ?? (await getTaxRate());

  if (items.length === 0) {
    await orderRepo.updateSalesInvoiceDraft(orderId, { discount: 0 });
    await orderRepo.recalcSalesInvoiceTotals(orderId, taxRate);
    return;
  }

  const productIds = [...new Set(items.map((item) => item.product_id))];
  const productMap = await catalogRepo.getProductsByIds(productIds);
  const preview = await evaluateCartPromotions({
    storeId: order.store_id,
    saleMode: "wholesale",
    lines: items.map((item, index) => ({
      line_key: item.id || String(index),
      product_id: item.product_id,
      category_id: productMap.get(item.product_id)?.category_id ?? null,
      quantity: item.quantity,
      unit_price: Number(item.list_unit_price ?? item.unit_price),
    })),
  });

  const db = await getDb();
  await Promise.all(
    preview.lines.map(async (line) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (db as any)
        .from("order_items")
        .update({
          list_unit_price: line.list_unit_price,
          unit_price: line.unit_price,
          line_total: line.line_total,
          discount_amount: line.discount_amount,
          promotion_rule_id: line.promotion_rule_id,
        })
        .eq("id", line.line_key)
        .eq("order_id", orderId);
      if (error) throwDbError(error, "applyPromotionsToSalesInvoiceDraft");
    })
  );

  await Promise.all([
    orderRepo.updateSalesInvoiceDraft(orderId, {
      discount: preview.cart_discount,
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any)
      .from("orders")
      .update({ promo_discount: preview.cart_discount })
      .eq("id", orderId),
  ]);

  await orderRepo.recalcSalesInvoiceTotals(orderId, taxRate);
}

async function getTaxRate(): Promise<number> {
  const [flags, taxSetting] = await Promise.all([
    getFeatureFlags(),
    getSetting("tax_rate"),
  ]);
  if (!flags.tax) return 0;
  const rate = Number((taxSetting?.value as { rate?: number } | null)?.rate ?? 0);
  return Number.isFinite(rate) ? rate : 0;
}

export async function assertSalesInvoiceAccess(user: AppUser): Promise<void> {
  const activity = await getBusinessActivitySettings();
  if (!activity.enable_wholesale_sales) {
    throw new Error("بيع الجملة غير مفعّل — فعّله من إعدادات النشاط");
  }
  if (user.role === "cashier" && !activity.allow_cashier_wholesale) {
    throw new Error("الكاشير غير مسموح له ببيع الجملة");
  }
}

async function requireEditableDraft(orderId: string): Promise<Order> {
  const order = await orderRepo.getOrder(orderId);
  if (!order) throw new Error("الفاتورة غير موجودة");
  if (order.document_status !== "draft") {
    throw new Error("لا يمكن تعديل غير المسودة");
  }
  if (order.session_id) throw new Error("فاتورة المبيعات لازم تكون مستقلة عن الجلسة");
  return order;
}

function nextOrderNumber(documentDate: string, existingOnDateCount: number): string {
  const day = documentDate.replace(/-/g, "");
  return `SI-${day}-${String(existingOnDateCount + 1).padStart(4, "0")}`;
}

export async function listSalesInvoices(storeId: string): Promise<SalesInvoiceWithDetails[]> {
  const invoices = await orderRepo.listSalesInvoices(storeId);
  if (invoices.length === 0) return [];

  const [customers, warehouses, allLines] = await Promise.all([
    customerRepo.listCustomers(),
    warehouseRepo.listWarehouses(storeId),
    Promise.all(invoices.map((inv) => orderRepo.getOrderItems(inv.id))),
  ]);
  const productIds = [
    ...new Set(allLines.flat().map((line) => line.product_id).filter(Boolean)),
  ];
  const products = await catalogRepo.getProductsByIds(productIds);
  const productMap = new Map(
    [...products.values()].map((product) => [product.id, product.name] as const)
  );
  const customerMap = new Map(customers.map((c) => [c.id, c.name]));
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w.name]));

  return invoices.map((invoice, index) => ({
    ...invoice,
    lines: (allLines[index] ?? []).map((line) => ({
      ...line,
      productName: productMap.get(line.product_id) ?? "صنف",
    })),
    customerName: invoice.customer_id ? customerMap.get(invoice.customer_id) ?? null : null,
    warehouseName: invoice.warehouse_id ? warehouseMap.get(invoice.warehouse_id) ?? null : null,
  }));
}

export async function getSalesInvoice(orderId: string): Promise<SalesInvoiceWithDetails | null> {
  const order = await orderRepo.getOrder(orderId);
  if (!order || !order.document_status) return null;
  const items = await orderRepo.getOrderItems(orderId);
  const productIds = [...new Set(items.map((line) => line.product_id))];
  const [products, customer, warehouse] = await Promise.all([
    catalogRepo.getProductsByIds(productIds),
    order.customer_id ? customerRepo.getCustomer(order.customer_id) : null,
    order.warehouse_id ? warehouseRepo.getWarehouse(order.warehouse_id) : null,
  ]);
  return {
    ...order,
    lines: items.map((line) => ({
      ...line,
      productName: products.get(line.product_id)?.name ?? "صنف",
    })),
    customerName: customer?.name ?? null,
    warehouseName: warehouse?.name ?? null,
  };
}

export async function createDraftSalesInvoice(input: {
  storeId: string;
  warehouseId: string;
  customerId?: string | null;
  createdBy: string;
  documentDate?: string;
}): Promise<Order> {
  const documentDate = normalizeDocumentDate(input.documentDate ?? todayDocumentDate());
  await assertPeriodOpen(input.storeId, documentDateToOccurredAt(documentDate));
  const [activity, warehouses, dayCount] = await Promise.all([
    getBusinessActivitySettings(),
    warehouseRepo.listWarehouses(input.storeId),
    orderRepo.countSalesInvoicesOnDocumentDate(input.storeId, documentDate),
  ]);
  const warehouse = warehouses.find((w) => w.id === input.warehouseId && w.is_active);
  if (!warehouse) throw new Error("المخزن غير صالح");

  return orderRepo.insertSalesInvoiceDraft({
    storeId: input.storeId,
    warehouseId: input.warehouseId,
    customerId: input.customerId ?? null,
    orderNumber: nextOrderNumber(documentDate, dayCount),
    createdBy: input.createdBy,
    salesMode: "wholesale",
    activityType: activity.activity_type,
    documentDate,
  });
}

export async function updateDraftSalesInvoiceHeader(input: {
  orderId: string;
  customerId?: string | null;
  warehouseId?: string;
  discount?: number;
  documentDate?: string;
}): Promise<Order> {
  const order = await requireEditableDraft(input.orderId);
  const documentDate =
    input.documentDate !== undefined
      ? normalizeDocumentDate(input.documentDate)
      : normalizeDocumentDate(order.document_date ?? todayDocumentDate());
  await assertPeriodOpen(order.store_id, documentDateToOccurredAt(documentDate));
  if (input.warehouseId) {
    const warehouses = await warehouseRepo.listWarehouses(order.store_id);
    if (!warehouses.some((w) => w.id === input.warehouseId && w.is_active)) {
      throw new Error("المخزن غير صالح");
    }
  }
  if (input.customerId) {
    const customer = await customerRepo.getCustomer(input.customerId);
    if (!customer) throw new Error("العميل غير موجود");
  }
  await orderRepo.updateSalesInvoiceDraft(input.orderId, {
    customerId: input.customerId,
    warehouseId: input.warehouseId,
    discount: input.discount,
    ...(input.documentDate !== undefined ? { documentDate } : {}),
  });
  const taxRate = await getTaxRate();
  return orderRepo.recalcSalesInvoiceTotals(input.orderId, taxRate);
}

export type SalesInvoiceLineMutationResult = {
  line: SalesInvoiceLineWithName;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
};

async function resolveTaxRateFromCache(): Promise<number> {
  const [flags, taxSetting] = await Promise.all([getFeatureFlags(), getSetting("tax_rate")]);
  if (!flags.tax) return 0;
  const rate = Number((taxSetting?.value as { rate?: number } | null)?.rate ?? 0);
  return Number.isFinite(rate) ? rate : 0;
}

/**
 * Fast draft line add (or merge into existing same product) + totals delta.
 * Promotions are applied once at issue (not on every line) so entry stays snappy.
 */
export async function addSalesInvoiceLine(input: {
  orderId: string;
  productId: string;
  quantity: number;
  /** When set, lock this unit price (manual / by-amount). Otherwise price is resolved for the final qty. */
  unitPrice?: number;
  tierId?: string | null;
}): Promise<SalesInvoiceLineMutationResult> {
  const order = await requireEditableDraft(input.orderId);
  await assertPeriodOpen(order.store_id);
  if (input.quantity <= 0) throw new Error("الكمية لازم تكون أكبر من صفر");

  const [product, existingItems, taxRate] = await Promise.all([
    catalogRepo.getProduct(input.productId),
    orderRepo.getOrderItems(input.orderId),
    resolveTaxRateFromCache(),
  ]);
  if (!product || !product.is_active) throw new Error("الصنف غير موجود أو غير نشط");

  const sameProduct = existingItems.filter(
    (line) => line.product_id === input.productId && (line.variant_id ?? null) === null
  );
  const keep = sameProduct[0] ?? null;
  const priorQty = sameProduct.reduce((sum, line) => sum + line.quantity, 0);
  const priorLineTotal = sameProduct.reduce((sum, line) => sum + line.line_total, 0);
  const quantity = Number(((keep ? priorQty : 0) + input.quantity).toFixed(4));

  const lockPrice = input.unitPrice != null && Number.isFinite(input.unitPrice);
  let unitPrice = lockPrice ? (input.unitPrice as number) : undefined;
  let tierId = lockPrice ? (input.tierId ?? null) : null;

  if (!lockPrice) {
    const [activity, tiers] = await Promise.all([
      getBusinessActivitySettings(),
      listPriceTiers(input.productId),
    ]);
    const resolved = resolveUnitPrice({
      basePrice: product.base_price,
      quantity,
      saleUnit: product.sale_unit ?? product.unit,
      saleMode: "wholesale",
      autoApplyWholesale: activity.auto_apply_wholesale_by_quantity,
      tiers,
      packing: productPackingForPricing(product),
    });
    unitPrice = resolved.unitPrice;
    tierId = resolved.tierId;
  }

  if (unitPrice == null || !Number.isFinite(unitPrice)) {
    throw new Error("السعر غير صالح");
  }

  const lineTotal = Number((unitPrice * quantity).toFixed(2));

  if (keep) {
    // Collapse any prior duplicate rows for this product into one line.
    await Promise.all(
      sameProduct.slice(1).map((dup) => orderRepo.deleteSalesInvoiceLine(dup.id))
    );

    const line = await orderRepo.updateSalesInvoiceLine(keep.id, {
      quantity,
      unitPrice,
      lineTotal,
      baseQuantity: quantity,
      tierId,
      wholesaleApplied: true,
    });
    const db = await getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .from("order_items")
      .update({
        list_unit_price: unitPrice,
        discount_amount: 0,
        promotion_rule_id: null,
      })
      .eq("id", keep.id);

    const updated = await orderRepo.recalcSalesInvoiceTotals(input.orderId, taxRate, {
      order,
      subtotalDelta: lineTotal - priorLineTotal,
    });

    return {
      line: { ...line, productName: product.name },
      subtotal: updated.subtotal,
      discount: updated.discount,
      tax: updated.tax,
      total: updated.total,
    };
  }

  const line = await orderRepo.insertSalesInvoiceLine({
    orderId: input.orderId,
    productId: input.productId,
    quantity,
    unitPrice,
    lineTotal,
    saleUnit: product.sale_unit ?? product.unit,
    baseQuantity: quantity,
    tierId,
    wholesaleApplied: true,
    listUnitPrice: unitPrice,
  });

  const updated = await orderRepo.recalcSalesInvoiceTotals(input.orderId, taxRate, {
    order,
    subtotalDelta: lineTotal,
  });

  return {
    line: { ...line, productName: product.name },
    subtotal: updated.subtotal,
    discount: updated.discount,
    tax: updated.tax,
    total: updated.total,
  };
}

export async function updateSalesInvoiceLine(input: {
  lineId: string;
  quantity: number;
  unitPrice?: number;
  /** When true (default on qty change), refresh unit price from wholesale tiers. */
  repriceFromTiers?: boolean;
}): Promise<SalesInvoiceLineMutationResult> {
  if (input.quantity <= 0) throw new Error("الكمية لازم تكون أكبر من صفر");

  const existing = await orderRepo.getOrderItem(input.lineId);
  if (!existing) throw new Error("سطر الفاتورة غير موجود");
  const order = await requireEditableDraft(existing.order_id);
  await assertPeriodOpen(order.store_id);

  let unitPrice = input.unitPrice;
  let tierId = existing.tier_id;
  const reprice = input.repriceFromTiers === true || input.unitPrice === undefined;
  let productName = "صنف";

  if (reprice) {
    const [product, activity, tiers] = await Promise.all([
      catalogRepo.getProduct(existing.product_id),
      getBusinessActivitySettings(),
      listPriceTiers(existing.product_id),
    ]);
    if (!product) throw new Error("الصنف غير موجود");
    productName = product.name;
    const resolved = resolveUnitPrice({
      basePrice: product.base_price,
      quantity: input.quantity,
      saleUnit: product.sale_unit ?? product.unit,
      saleMode: "wholesale",
      autoApplyWholesale: activity.auto_apply_wholesale_by_quantity,
      tiers,
      packing: productPackingForPricing(product),
    });
    unitPrice = resolved.unitPrice;
    tierId = resolved.tierId;
  } else {
    const product = await catalogRepo.getProduct(existing.product_id);
    productName = product?.name ?? "صنف";
  }

  if (unitPrice == null || !Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error("السعر غير صالح");
  }

  const lineTotal = Number((unitPrice * input.quantity).toFixed(2));
  const [line, taxRate] = await Promise.all([
    orderRepo.updateSalesInvoiceLine(input.lineId, {
      quantity: input.quantity,
      unitPrice,
      lineTotal,
      baseQuantity: input.quantity,
      ...(reprice ? { tierId, wholesaleApplied: true } : {}),
    }),
    resolveTaxRateFromCache(),
  ]);

  // Keep list price in sync without a second promo pass (promos run at issue).
  const db = await getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .from("order_items")
    .update({
      list_unit_price: unitPrice,
      discount_amount: 0,
      promotion_rule_id: null,
    })
    .eq("id", input.lineId);

  const updated = await orderRepo.recalcSalesInvoiceTotals(order.id, taxRate, {
    order,
    subtotalDelta: lineTotal - existing.line_total,
  });

  return {
    line: { ...line, productName },
    subtotal: updated.subtotal,
    discount: updated.discount,
    tax: updated.tax,
    total: updated.total,
  };
}

export async function removeSalesInvoiceLine(lineId: string): Promise<{
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}> {
  const existing = await orderRepo.getOrderItem(lineId);
  if (!existing) throw new Error("سطر الفاتورة غير موجود");
  const order = await requireEditableDraft(existing.order_id);
  await assertPeriodOpen(order.store_id);
  const taxRate = await resolveTaxRateFromCache();
  await orderRepo.deleteSalesInvoiceLine(lineId);
  const updated = await orderRepo.recalcSalesInvoiceTotals(order.id, taxRate, {
    order,
    subtotalDelta: -existing.line_total,
  });
  return {
    subtotal: updated.subtotal,
    discount: updated.discount,
    tax: updated.tax,
    total: updated.total,
  };
}

export async function deleteDraftSalesInvoice(orderId: string): Promise<void> {
  const order = await requireEditableDraft(orderId);
  await assertPeriodOpen(order.store_id);
  await orderRepo.deleteSalesInvoiceDraft(orderId);
}

export async function issueSalesInvoice(orderId: string): Promise<void> {
  const order = await orderRepo.getOrder(orderId);
  if (!order) throw new Error("الفاتورة غير موجودة");
  const documentDate = normalizeDocumentDate(order.document_date ?? todayDocumentDate());
  await assertPeriodOpen(order.store_id, documentDateToOccurredAt(documentDate));
  // Apply promotions once before locking the document — keeps line entry fast.
  await applyPromotionsToSalesInvoiceDraft(orderId, { order });
  await orderRepo.issueSalesInvoiceRpc(orderId);
}

export async function deliverSalesInvoice(input: {
  orderId: string;
  paymentMethod: PaymentMethod | null;
  /** Deposit + credit remainder (or pure credit / cash). Matches POS split shape. */
  payments?: PaymentSplit[];
}): Promise<void> {
  const order = await orderRepo.getOrder(input.orderId);
  if (!order) throw new Error("الفاتورة غير موجودة");
  if (order.document_status !== "issued") {
    throw new Error("التسليم متاح للفواتير الصادرة فقط");
  }
  const documentDate = normalizeDocumentDate(order.document_date ?? todayDocumentDate());
  await assertPeriodOpen(order.store_id, documentDateToOccurredAt(documentDate));

  const payments = input.payments?.filter((p) => p.amount > 0);
  if (payments?.some((p) => p.method === "credit") && !order.customer_id) {
    throw new Error("اختر عميلًا لتسليم فاتورة آجل");
  }

  await orderRepo.deliverSalesInvoiceRpc({
    orderId: input.orderId,
    paymentMethod: input.paymentMethod,
    payments: payments && payments.length > 0 ? payments : undefined,
  });
}

export interface CorrectDeliveredCostsResult {
  previousTotal: number;
  nextTotal: number;
  changedLines: number;
  lines: CostCorrectionLineResult[];
}

/**
 * Re-snapshot COGS on a delivered wholesale invoice from current product costs.
 * Does not change quantities, sell prices, stock, or payments.
 */
export async function correctDeliveredSalesInvoiceCosts(
  orderId: string,
  actor: AppUser
): Promise<CorrectDeliveredCostsResult> {
  if (actor.role !== "owner" && actor.role !== "manager") {
    throw new Error("تصحيح التكلفة متاح للمالك والمدير فقط");
  }

  const order = await orderRepo.getOrder(orderId);
  if (!order) throw new Error("الفاتورة غير موجودة");
  if (order.document_status !== "delivered") {
    throw new Error("تصحيح التكلفة متاح للفواتير المُسلَّمة فقط");
  }
  if (order.session_id) {
    throw new Error("فاتورة المبيعات لازم تكون مستقلة عن الجلسة");
  }

  const documentDate = normalizeDocumentDate(
    order.document_date ?? todayDocumentDate()
  );
  await assertPeriodOpen(order.store_id, documentDateToOccurredAt(documentDate));

  const items = await orderRepo.getOrderItems(orderId);
  if (items.length === 0) {
    throw new Error("الفاتورة مفيش فيها أسطر");
  }

  const flags = await getFeatureFlags();
  const productIds = [...new Set(items.map((item) => item.product_id))];
  const productMap = await catalogRepo.getProductsByIds(productIds);

  const recipeCostByKey = new Map<string, number>();
  if (flags.recipes) {
    const keys = [
      ...new Set(
        items.map((item) => `${item.product_id}:${item.variant_id ?? ""}`)
      ),
    ];
    await Promise.all(
      keys.map(async (key) => {
        const [productId, variantRaw] = key.split(":");
        if (!productId) return;
        const variantId = variantRaw ? variantRaw : null;
        const recipe = await recipeRepo.getRecipeWithLines(productId, variantId);
        if (!recipe) return;
        recipeCostByKey.set(
          key,
          recipeRepo.computeRecipeTotalCost(recipe.lines)
        );
      })
    );
  }

  const productCostById = new Map<string, CostCorrectionProductCost>();
  for (const productId of productIds) {
    productCostById.set(productId, {
      last_unit_cost: productMap.get(productId)?.last_unit_cost ?? 0,
    });
  }

  const corrections = items.flatMap((item) => {
    const recipeKey = `${item.product_id}:${item.variant_id ?? ""}`;
    const recipeUnitCost = recipeCostByKey.has(recipeKey)
      ? recipeCostByKey.get(recipeKey)!
      : null;
    return buildSalesInvoiceCostCorrections(
      [item],
      new Map([
        [
          item.product_id,
          {
            last_unit_cost:
              productCostById.get(item.product_id)?.last_unit_cost ?? 0,
            recipe_unit_cost: recipeUnitCost,
          },
        ],
      ])
    );
  });

  const summary = summarizeCostCorrections(corrections);
  const changed = corrections.filter((row) => row.changed);
  if (changed.length === 0) {
    return { ...summary, lines: corrections };
  }

  await orderRepo.updateDeliveredOrderItemCosts(
    orderId,
    changed.map((row) => ({
      lineId: row.lineId,
      unitCost: row.unitCost,
      lineCost: row.lineCost,
    }))
  );

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: order.store_id,
    userId: actor.id,
    action: "sales_invoice.cost_corrected",
    entityType: "order",
    entityId: orderId,
    metadata: {
      previous_total_cost: summary.previousTotal,
      next_total_cost: summary.nextTotal,
      changed_lines: summary.changedLines,
      lines: changed.map((row) => ({
        line_id: row.lineId,
        product_id: row.productId,
        from: row.previousLineCost,
        to: row.lineCost,
      })),
    },
  });

  return { ...summary, lines: corrections };
}

export type { Customer, Product, Warehouse, SalesDocumentStatus };
