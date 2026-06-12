import { callRpc, throwDbError } from "@/lib/repositories/client";

export async function getSalesSummaryRpc(options: {
  storeId?: string;
  from?: string;
  to?: string;
  paymentMethod?: string;
}) {
  const { data, error } = await callRpc<
    { total_revenue: number; order_count: number; avg_order_value: number }[]
  >("report_sales_summary", {
    p_store_id: options.storeId ?? null,
    p_from: options.from ?? null,
    p_to: options.to ?? null,
    p_payment_method: options.paymentMethod ?? null,
  });
  if (error) throwDbError(error, "report_sales_summary");
  const row = Array.isArray(data) ? data[0] : null;
  return {
    totalRevenue: Number(row?.total_revenue ?? 0),
    orderCount: Number(row?.order_count ?? 0),
    avgOrderValue: Number(row?.avg_order_value ?? 0),
  };
}

export async function getSalesByDayRpc(options: {
  storeId?: string;
  from?: string;
  to?: string;
}) {
  const { data, error } = await callRpc<
    { day: string; revenue: number; order_count: number }[]
  >("report_sales_by_day", {
    p_store_id: options.storeId ?? null,
    p_from: options.from ?? null,
    p_to: options.to ?? null,
  });
  if (error) throwDbError(error, "report_sales_by_day");
  return (data ?? []).map((row) => ({
    date: row.day,
    revenue: Number(row.revenue),
    orders: Number(row.order_count),
  }));
}

export async function getSessionReconciliationRpc(sessionId: string) {
  const { data, error } = await callRpc<
    {
      opening_cash: number;
      cash_sales: number;
      card_sales: number;
      wallet_sales: number;
      credit_sales: number;
      cash_refunds: number;
      expenses: number;
      customer_payments: number;
      expected_cash: number;
    }[]
  >("report_session_reconciliation", { p_session_id: sessionId });
  if (error) throwDbError(error, "report_session_reconciliation");
  const row = Array.isArray(data) ? data[0] : null;
  return {
    openingCash: Number(row?.opening_cash ?? 0),
    cashSales: Number(row?.cash_sales ?? 0),
    cardSales: Number(row?.card_sales ?? 0),
    walletSales: Number(row?.wallet_sales ?? 0),
    creditSales: Number(row?.credit_sales ?? 0),
    cashRefunds: Number(row?.cash_refunds ?? 0),
    expenses: Number(row?.expenses ?? 0),
    customerPayments: Number(row?.customer_payments ?? 0),
    expectedCash: Number(row?.expected_cash ?? 0),
  };
}

export async function getInventoryValuationRpc(storeId?: string) {
  const { data, error } = await callRpc<
    {
      product_id: string;
      product_name: string;
      quantity: number;
      unit_cost: number;
      total_value: number;
    }[]
  >("report_inventory_valuation", { p_store_id: storeId ?? null });
  if (error) throwDbError(error, "report_inventory_valuation");
  return (data ?? []).map((row) => ({
    productId: row.product_id,
    productName: row.product_name,
    quantity: Number(row.quantity),
    unitCost: Number(row.unit_cost),
    totalValue: Number(row.total_value),
  }));
}

export type ExpiryBatchRow = {
  batchId: string;
  productName: string;
  batchNumber: string;
  expiryDate: string;
  remainingQuantity: number;
  daysUntilExpiry: number;
};

export async function getExpiryBatchesRpc(
  storeId?: string,
  status = "all"
): Promise<ExpiryBatchRow[]> {
  const { data, error } = await callRpc<
    {
      batch_id: string;
      product_name: string;
      batch_number: string;
      expiry_date: string;
      remaining_quantity: number;
      days_until_expiry: number;
    }[]
  >("report_expiry_batches", {
    p_store_id: storeId ?? null,
    p_status: status,
  });
  if (error) throwDbError(error, "report_expiry_batches");
  return (data ?? []).map((row) => ({
    batchId: row.batch_id,
    productName: row.product_name,
    batchNumber: row.batch_number,
    expiryDate: row.expiry_date,
    remainingQuantity: Number(row.remaining_quantity),
    daysUntilExpiry: Number(row.days_until_expiry),
  }));
}
