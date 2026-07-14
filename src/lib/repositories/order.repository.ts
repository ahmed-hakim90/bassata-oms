import { callRpc, getDb, throwDbError } from "@/lib/repositories/client";
import { mapOrder, mapOrderItem, mapOrderItemDeduction, mapOrderPayment } from "@/lib/repositories/mappers";
import { listStores } from "@/lib/repositories/store.repository";
import { roundMoney } from "@/lib/money";
import { computeInvoiceTotals } from "@/modules/sales-invoices/lib/invoice-math";
import type {
  Order,
  OrderItem,
  OrderItemDeduction,
  OrderPayment,
  PaymentMethod,
  PaymentSplit,
  SalesMode,
} from "@/lib/types";

export interface OrderListFilters {
  storeId?: string;
  status?: Order["status"] | Order["status"][];
  from?: string;
  to?: string;
  limit?: number;
  sessionId?: string;
}

/** Accepts storeId string (legacy) or filter object. */
export async function listOrders(
  storeIdOrFilters?: string | OrderListFilters
): Promise<Order[]> {
  const filters: OrderListFilters =
    typeof storeIdOrFilters === "string" || storeIdOrFilters === undefined
      ? { storeId: storeIdOrFilters }
      : storeIdOrFilters;

  const db = await getDb();
  const storeIds = (await listStores()).map((store) => store.id);
  if (storeIds.length === 0) return [];
  let q = db.from("orders").select("*").order("created_at", { ascending: false });
  q = q.in("store_id", storeIds);
  if (filters.storeId) q = q.eq("store_id", filters.storeId);
  if (filters.sessionId) q = q.eq("session_id", filters.sessionId);
  if (filters.status) {
    q = Array.isArray(filters.status)
      ? q.in("status", filters.status)
      : q.eq("status", filters.status);
  }
  if (filters.from) q = q.gte("created_at", filters.from);
  if (filters.to) q = q.lte("created_at", filters.to);
  if (filters.limit != null) q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) throwDbError(error, "listOrders");
  return (data ?? []).map(mapOrder);
}

export async function listOrdersBySessionIds(sessionIds: string[]): Promise<Order[]> {
  if (sessionIds.length === 0) return [];
  const db = await getDb();
  // Scope via orders RLS (has_store_access). Do not gate on listStores() —
  // an empty store list would hide real session sales used for close/admin.
  const { data, error } = await db
    .from("orders")
    .select("*")
    .in("session_id", sessionIds)
    .order("created_at", { ascending: false });
  if (error) throwDbError(error, "listOrdersBySessionIds");
  return (data ?? []).map(mapOrder);
}

export async function getOrderPaymentsForOrders(orderIds: string[]): Promise<OrderPayment[]> {
  if (orderIds.length === 0) return [];
  const db = await getDb();
  const { data, error } = await db.from("order_payments").select("*").in("order_id", orderIds);
  if (error) throwDbError(error, "getOrderPaymentsForOrders");
  return (data ?? []).map(mapOrderPayment);
}

export async function getOrder(id: string): Promise<Order | null> {
  const db = await getDb();
  const storeIds = (await listStores()).map((store) => store.id);
  if (storeIds.length === 0) return null;
  const { data, error } = await db
    .from("orders")
    .select("*")
    .eq("id", id)
    .in("store_id", storeIds)
    .maybeSingle();
  if (error) throwDbError(error, "getOrder");
  return data ? mapOrder(data) : null;
}

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  const db = await getDb();
  const { data, error } = await db.from("order_items").select("*").eq("order_id", orderId);
  if (error) throwDbError(error, "getOrderItems");
  return (data ?? []).map(mapOrderItem);
}

export async function getOrderItem(lineId: string): Promise<OrderItem | null> {
  const db = await getDb();
  const { data, error } = await db.from("order_items").select("*").eq("id", lineId).maybeSingle();
  if (error) throwDbError(error, "getOrderItem");
  return data ? mapOrderItem(data) : null;
}

export async function getOrderPayments(orderId: string): Promise<OrderPayment[]> {
  const db = await getDb();
  const { data, error } = await db.from("order_payments").select("*").eq("order_id", orderId);
  if (error) throwDbError(error, "getOrderPayments");
  return (data ?? []).map(mapOrderPayment);
}

export async function getOrderItemDeductions(
  orderItemIds: string[]
): Promise<OrderItemDeduction[]> {
  if (orderItemIds.length === 0) return [];
  const db = await getDb();
  const { data, error } = await db
    .from("order_item_deductions")
    .select("*")
    .in("order_item_id", orderItemIds);
  if (error) throwDbError(error, "getOrderItemDeductions");
  return (data ?? []).map(mapOrderItemDeduction);
}

export async function getOrderDeductionsByOrderId(
  orderId: string
): Promise<OrderItemDeduction[]> {
  const items = await getOrderItems(orderId);
  return getOrderItemDeductions(items.map((i) => i.id));
}

export async function updateOrderStatus(
  id: string,
  status: Order["status"]
): Promise<Order | null> {
  const db = await getDb();
  const storeIds = (await listStores()).map((store) => store.id);
  if (storeIds.length === 0) return null;
  const { data, error } = await db
    .from("orders")
    .update({ status })
    .eq("id", id)
    .in("store_id", storeIds)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateOrderStatus");
  return data ? mapOrder(data) : null;
}

export async function updateOrderPaymentStatus(
  id: string,
  paymentStatus: Order["payment_status"]
): Promise<Order | null> {
  const db = await getDb();
  const storeIds = (await listStores()).map((store) => store.id);
  if (storeIds.length === 0) return null;
  const { data, error } = await db
    .from("orders")
    .update({ payment_status: paymentStatus })
    .eq("id", id)
    .in("store_id", storeIds)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateOrderPaymentStatus");
  return data ? mapOrder(data) : null;
}

export async function addOrderPayment(input: {
  orderId: string;
  method: PaymentMethod;
  amount: number;
  reference?: string | null;
}): Promise<OrderPayment> {
  const db = await getDb();
  const order = await getOrder(input.orderId);
  if (!order) {
    throw new Error("Order not found or out of scope");
  }
  const { data, error } = await db
    .from("order_payments")
    .insert({
      order_id: input.orderId,
      method: input.method,
      amount: input.amount,
      reference: input.reference ?? null,
    })
    .select()
    .single();
  if (error || !data) throwDbError(error, "addOrderPayment");
  return mapOrderPayment(data);
}

export async function completeCheckoutRpc(input: {
  storeId: string;
  sessionId: string;
  cashierId: string;
  deviceId?: string | null;
  customerId: string | null;
  paymentMethod: PaymentMethod;
  salesMode?: SalesMode;
  discount: number;
  couponCode?: string | null;
  lines: {
    product_id: string;
    variant_id: string | null;
    quantity: number;
    sale_input_mode?: string;
    entered_amount?: number;
    tier_id?: string | null;
  }[];
}): Promise<{
  order_id: string;
  order_number: string;
  subtotal: number;
  tax: number;
  total: number;
}> {
  const { data, error } = await callRpc<Record<string, unknown>>("complete_checkout", {
    p_store_id: input.storeId,
    p_session_id: input.sessionId,
    p_cashier_id: input.cashierId,
    p_customer_id: input.customerId,
    p_payment_method: input.paymentMethod,
    p_discount: input.discount,
    p_lines: input.lines,
    p_device_id: input.deviceId ?? null,
    p_sales_mode: input.salesMode ?? "retail",
    p_coupon_code: input.couponCode ?? null,
  });
  if (error) throwDbError(error, "completeCheckout");
  const result = data as Record<string, unknown>;
  return {
    order_id: result.order_id as string,
    order_number: result.order_number as string,
    subtotal: Number(result.subtotal),
    tax: Number(result.tax),
    total: Number(result.total),
  };
}

export async function completeCheckoutSplitRpc(input: {
  storeId: string;
  sessionId: string;
  cashierId: string;
  deviceId?: string | null;
  customerId: string | null;
  paymentMethod: PaymentMethod;
  salesMode?: SalesMode;
  discount: number;
  couponCode?: string | null;
  lines: {
    product_id: string;
    variant_id: string | null;
    quantity: number;
    sale_input_mode?: string;
    entered_amount?: number;
    tier_id?: string | null;
  }[];
  payments: PaymentSplit[];
}): Promise<{
  order_id: string;
  order_number: string;
  subtotal: number;
  tax: number;
  total: number;
  payment_status?: "paid" | "unpaid" | "partial";
  credit_amount?: number;
}> {
  const { data, error } = await callRpc<Record<string, unknown>>("complete_checkout_split", {
    p_store_id: input.storeId,
    p_session_id: input.sessionId,
    p_cashier_id: input.cashierId,
    p_customer_id: input.customerId,
    p_payment_method: input.paymentMethod,
    p_discount: input.discount,
    p_lines: input.lines,
    p_payments: input.payments,
    p_device_id: input.deviceId ?? null,
    p_sales_mode: input.salesMode ?? "retail",
    p_coupon_code: input.couponCode ?? null,
  });
  if (error) throwDbError(error, "completeCheckoutSplit");
  const result = data as Record<string, unknown>;
  return {
    order_id: result.order_id as string,
    order_number: result.order_number as string,
    subtotal: Number(result.subtotal),
    tax: Number(result.tax),
    total: Number(result.total),
    payment_status:
      result.payment_status === "paid" ||
      result.payment_status === "unpaid" ||
      result.payment_status === "partial"
        ? result.payment_status
        : undefined,
    credit_amount:
      result.credit_amount !== undefined ? Number(result.credit_amount) : undefined,
  };
}

export async function completeCheckoutExpiredOverrideRpc(input: {
  storeId: string;
  sessionId: string;
  cashierId: string;
  deviceId?: string | null;
  customerId: string | null;
  paymentMethod: PaymentMethod;
  salesMode?: SalesMode;
  discount: number;
  couponCode?: string | null;
  lines: {
    product_id: string;
    variant_id: string | null;
    quantity: number;
    sale_input_mode?: string;
    entered_amount?: number;
    tier_id?: string | null;
  }[];
}): Promise<{
  order_id: string;
  order_number: string;
  subtotal: number;
  tax: number;
  total: number;
}> {
  const { data, error } = await callRpc<Record<string, unknown>>("complete_checkout_expired_override", {
    p_store_id: input.storeId,
    p_session_id: input.sessionId,
    p_cashier_id: input.cashierId,
    p_customer_id: input.customerId,
    p_payment_method: input.paymentMethod,
    p_discount: input.discount,
    p_lines: input.lines,
    p_device_id: input.deviceId ?? null,
    p_sales_mode: input.salesMode ?? "retail",
    p_coupon_code: input.couponCode ?? null,
  });
  if (error) throwDbError(error, "completeCheckoutExpiredOverride");
  const result = data as Record<string, unknown>;
  return {
    order_id: result.order_id as string,
    order_number: result.order_number as string,
    subtotal: Number(result.subtotal),
    tax: Number(result.tax),
    total: Number(result.total),
  };
}

export async function completeCheckoutSplitExpiredOverrideRpc(input: {
  storeId: string;
  sessionId: string;
  cashierId: string;
  deviceId?: string | null;
  customerId: string | null;
  paymentMethod: PaymentMethod;
  salesMode?: SalesMode;
  discount: number;
  couponCode?: string | null;
  lines: {
    product_id: string;
    variant_id: string | null;
    quantity: number;
    sale_input_mode?: string;
    entered_amount?: number;
    tier_id?: string | null;
  }[];
  payments: PaymentSplit[];
}): Promise<{
  order_id: string;
  order_number: string;
  subtotal: number;
  tax: number;
  total: number;
  payment_status?: "paid" | "unpaid" | "partial";
  credit_amount?: number;
}> {
  const { data, error } = await callRpc<Record<string, unknown>>(
    "complete_checkout_split_expired_override",
    {
      p_store_id: input.storeId,
      p_session_id: input.sessionId,
      p_cashier_id: input.cashierId,
      p_customer_id: input.customerId,
      p_payment_method: input.paymentMethod,
      p_discount: input.discount,
      p_lines: input.lines,
      p_payments: input.payments,
      p_device_id: input.deviceId ?? null,
      p_sales_mode: input.salesMode ?? "retail",
      p_coupon_code: input.couponCode ?? null,
    }
  );
  if (error) throwDbError(error, "completeCheckoutSplitExpiredOverride");
  const result = data as Record<string, unknown>;
  return {
    order_id: result.order_id as string,
    order_number: result.order_number as string,
    subtotal: Number(result.subtotal),
    tax: Number(result.tax),
    total: Number(result.total),
    payment_status:
      result.payment_status === "paid" ||
      result.payment_status === "unpaid" ||
      result.payment_status === "partial"
        ? result.payment_status
        : undefined,
    credit_amount:
      result.credit_amount !== undefined ? Number(result.credit_amount) : undefined,
  };
}

export async function completeUnpaidCheckoutRpc(input: {
  storeId: string;
  sessionId: string;
  cashierId: string;
  customerId: string | null;
  discount: number;
  lines: { product_id: string; variant_id: string | null; quantity: number }[];
}): Promise<{
  order_id: string;
  order_number: string;
  subtotal: number;
  tax: number;
  total: number;
}> {
  const { data, error } = await callRpc<Record<string, unknown>>("complete_unpaid_checkout", {
    p_store_id: input.storeId,
    p_session_id: input.sessionId,
    p_cashier_id: input.cashierId,
    p_customer_id: input.customerId,
    p_discount: input.discount,
    p_lines: input.lines,
  });
  if (error) throwDbError(error, "completeUnpaidCheckout");
  const result = data as Record<string, unknown>;
  return {
    order_id: result.order_id as string,
    order_number: result.order_number as string,
    subtotal: Number(result.subtotal),
    tax: Number(result.tax),
    total: Number(result.total),
  };
}

export type OrderReverseRpcResult = {
  order_id: string;
  status: string;
  order_number: string;
  total: number;
  restock: {
    restocked: boolean;
    restock_movement_count: number;
    restock_quantity_total: number;
    credit_reversed: number;
    reference_type: string;
  };
};

function mapOrderReverseRpc(data: Record<string, unknown>): OrderReverseRpcResult {
  const restock = (data.restock ?? {}) as Record<string, unknown>;
  return {
    order_id: data.order_id as string,
    status: data.status as string,
    order_number: data.order_number as string,
    total: Number(data.total),
    restock: {
      restocked: Boolean(restock.restocked),
      restock_movement_count: Number(restock.restock_movement_count ?? 0),
      restock_quantity_total: Number(restock.restock_quantity_total ?? 0),
      credit_reversed: Number(restock.credit_reversed ?? 0),
      reference_type: String(restock.reference_type ?? ""),
    },
  };
}

export async function refundOrderRpc(input: {
  orderId: string;
  actorId?: string | null;
}): Promise<OrderReverseRpcResult> {
  const { data, error } = await callRpc<Record<string, unknown>>("refund_order", {
    p_order_id: input.orderId,
    p_actor_id: input.actorId ?? null,
  });
  if (error) throwDbError(error, "refundOrder");
  return mapOrderReverseRpc((data ?? {}) as Record<string, unknown>);
}

export async function voidOrderRpc(input: {
  orderId: string;
  actorId?: string | null;
}): Promise<OrderReverseRpcResult> {
  const { data, error } = await callRpc<Record<string, unknown>>("void_order", {
    p_order_id: input.orderId,
    p_actor_id: input.actorId ?? null,
  });
  if (error) throwDbError(error, "voidOrder");
  return mapOrderReverseRpc((data ?? {}) as Record<string, unknown>);
}

export async function listSalesInvoices(storeId: string): Promise<Order[]> {
  const db = await getDb();
  const storeIds = (await listStores()).map((store) => store.id);
  if (storeIds.length === 0 || !storeIds.includes(storeId)) return [];
  const { data, error } = await db
    .from("orders")
    .select("*")
    .eq("store_id", storeId)
    .not("document_status", "is", null)
    .order("document_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throwDbError(error, "listSalesInvoices");
  return (data ?? []).map(mapOrder);
}

/** Count SI drafts/issued/delivered on a document_date — for numbering. */
export async function countSalesInvoicesOnDocumentDate(
  storeId: string,
  documentDate: string
): Promise<number> {
  const db = await getDb();
  const storeIds = (await listStores()).map((store) => store.id);
  if (storeIds.length === 0 || !storeIds.includes(storeId)) return 0;
  const { count, error } = await db
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .not("document_status", "is", null)
    .eq("document_date", documentDate);
  if (error) throwDbError(error, "countSalesInvoicesOnDocumentDate");
  return count ?? 0;
}

export async function insertSalesInvoiceDraft(input: {
  storeId: string;
  warehouseId: string;
  customerId: string | null;
  orderNumber: string;
  createdBy: string;
  salesMode: SalesMode;
  activityType: string;
  documentDate: string;
  discount?: number;
  subtotal?: number;
  tax?: number;
  total?: number;
}): Promise<Order> {
  const db = await getDb();
  const { data, error } = await db
    .from("orders")
    .insert({
      store_id: input.storeId,
      session_id: null,
      order_number: input.orderNumber,
      customer_id: input.customerId,
      status: "open",
      document_status: "draft",
      document_date: input.documentDate,
      warehouse_id: input.warehouseId,
      subtotal: input.subtotal ?? 0,
      discount: input.discount ?? 0,
      tax: input.tax ?? 0,
      total: input.total ?? 0,
      payment_status: "unpaid",
      created_by: input.createdBy,
      sales_mode: input.salesMode,
      activity_type: input.activityType as Order["activity_type"],
    })
    .select("*")
    .single();
  if (error || !data) throwDbError(error, "insertSalesInvoiceDraft");
  return mapOrder(data);
}

export async function updateSalesInvoiceDraft(
  orderId: string,
  patch: {
    customerId?: string | null;
    warehouseId?: string;
    discount?: number;
    subtotal?: number;
    tax?: number;
    total?: number;
    documentDate?: string;
  }
): Promise<Order> {
  const db = await getDb();
  const storeIds = (await listStores()).map((store) => store.id);
  if (storeIds.length === 0) throw new Error("Store scope empty");
  const { data, error } = await db
    .from("orders")
    .update({
      ...(patch.customerId !== undefined ? { customer_id: patch.customerId } : {}),
      ...(patch.warehouseId !== undefined ? { warehouse_id: patch.warehouseId } : {}),
      ...(patch.discount !== undefined ? { discount: patch.discount } : {}),
      ...(patch.subtotal !== undefined ? { subtotal: patch.subtotal } : {}),
      ...(patch.tax !== undefined ? { tax: patch.tax } : {}),
      ...(patch.total !== undefined ? { total: patch.total } : {}),
      ...(patch.documentDate !== undefined ? { document_date: patch.documentDate } : {}),
    })
    .eq("id", orderId)
    .eq("document_status", "draft")
    .in("store_id", storeIds)
    .select("*")
    .single();
  if (error || !data) throwDbError(error, "updateSalesInvoiceDraft");
  return mapOrder(data);
}

export async function insertSalesInvoiceLine(input: {
  orderId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  saleUnit?: string | null;
  baseQuantity?: number | null;
  tierId?: string | null;
  wholesaleApplied?: boolean;
  listUnitPrice?: number;
}): Promise<OrderItem> {
  const db = await getDb();
  // list_unit_price / promotion columns may exist beyond generated Insert types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("order_items")
    .insert({
      order_id: input.orderId,
      product_id: input.productId,
      variant_id: input.variantId ?? null,
      quantity: input.quantity,
      unit_price: input.unitPrice,
      modifiers: [],
      line_total: input.lineTotal,
      unit_cost: 0,
      line_cost: 0,
      sale_unit: (input.saleUnit as OrderItem["sale_unit"]) ?? null,
      base_quantity: input.baseQuantity ?? input.quantity,
      sale_input_mode: null,
      tier_id: input.tierId ?? null,
      wholesale_applied: input.wholesaleApplied ?? true,
      line_note: null,
      list_unit_price: input.listUnitPrice ?? input.unitPrice,
      discount_amount: 0,
      promotion_rule_id: null,
    })
    .select("*")
    .single();
  if (error || !data) throwDbError(error, "insertSalesInvoiceLine");
  return mapOrderItem(data);
}

export async function updateSalesInvoiceLine(
  lineId: string,
  patch: {
    quantity?: number;
    unitPrice?: number;
    lineTotal?: number;
    baseQuantity?: number | null;
    tierId?: string | null;
    wholesaleApplied?: boolean;
  }
): Promise<OrderItem> {
  const db = await getDb();
  const { data, error } = await db
    .from("order_items")
    .update({
      ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
      ...(patch.unitPrice !== undefined ? { unit_price: patch.unitPrice } : {}),
      ...(patch.lineTotal !== undefined ? { line_total: patch.lineTotal } : {}),
      ...(patch.baseQuantity !== undefined ? { base_quantity: patch.baseQuantity } : {}),
      ...(patch.tierId !== undefined ? { tier_id: patch.tierId } : {}),
      ...(patch.wholesaleApplied !== undefined
        ? { wholesale_applied: patch.wholesaleApplied }
        : {}),
    })
    .eq("id", lineId)
    .select("*")
    .single();
  if (error || !data) throwDbError(error, "updateSalesInvoiceLine");
  return mapOrderItem(data);
}

export async function deleteSalesInvoiceLine(lineId: string): Promise<void> {
  const db = await getDb();
  const { error } = await db.from("order_items").delete().eq("id", lineId);
  if (error) throwDbError(error, "deleteSalesInvoiceLine");
}

export async function deleteSalesInvoiceDraft(orderId: string): Promise<void> {
  const db = await getDb();
  const storeIds = (await listStores()).map((store) => store.id);
  if (storeIds.length === 0) throw new Error("Store scope empty");
  const { error: linesError } = await db.from("order_items").delete().eq("order_id", orderId);
  if (linesError) throwDbError(linesError, "deleteSalesInvoiceDraftLines");
  const { error } = await db
    .from("orders")
    .delete()
    .eq("id", orderId)
    .eq("document_status", "draft")
    .in("store_id", storeIds);
  if (error) throwDbError(error, "deleteSalesInvoiceDraft");
}

export async function recalcSalesInvoiceTotals(
  orderId: string,
  taxRate: number,
  options?: { order?: Order; items?: OrderItem[]; subtotalDelta?: number }
): Promise<Order> {
  const order = options?.order ?? (await getOrder(orderId));
  if (!order) throw new Error("Order not found");

  let subtotal: number;
  if (typeof options?.subtotalDelta === "number") {
    subtotal = roundMoney(order.subtotal + options.subtotalDelta);
    const discount = Math.max(0, order.discount);
    const tax = roundMoney(Math.max(0, subtotal - discount) * taxRate);
    const total = roundMoney(Math.max(0, subtotal - discount + tax));
    return updateSalesInvoiceDraft(orderId, { subtotal, tax, total });
  }

  const items = options?.items ?? (await getOrderItems(orderId));
  const totals = computeInvoiceTotals({
    lines: items,
    discount: order.discount,
    taxRate,
  });
  return updateSalesInvoiceDraft(orderId, {
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
  });
}

export async function issueSalesInvoiceRpc(orderId: string): Promise<void> {
  const { error } = await callRpc("issue_sales_invoice", { p_order_id: orderId });
  if (error) throwDbError(error, "issueSalesInvoice");
}

export async function deliverSalesInvoiceRpc(input: {
  orderId: string;
  paymentMethod: PaymentMethod | null;
  payments?: PaymentSplit[];
}): Promise<void> {
  const { error } = await callRpc("deliver_sales_invoice", {
    p_order_id: input.orderId,
    p_payment_method: input.paymentMethod,
    p_payments: input.payments ?? null,
  });
  if (error) throwDbError(error, "deliverSalesInvoice");
}

/** Updates COGS snapshot only — does not touch qty, price, stock, or payments. */
export async function updateDeliveredOrderItemCosts(
  orderId: string,
  updates: Array<{ lineId: string; unitCost: number; lineCost: number }>
): Promise<void> {
  if (updates.length === 0) return;
  const db = await getDb();
  await Promise.all(
    updates.map(async (row) => {
      const { data, error } = await db
        .from("order_items")
        .update({
          unit_cost: row.unitCost,
          line_cost: row.lineCost,
        })
        .eq("id", row.lineId)
        .eq("order_id", orderId)
        .select("id")
        .maybeSingle();
      if (error) throwDbError(error, "updateDeliveredOrderItemCosts");
      if (!data) {
        throw new Error(`تعذر تحديث تكلفة السطر ${row.lineId}`);
      }
    })
  );
}

