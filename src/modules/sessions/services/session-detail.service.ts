import * as customerRepo from "@/lib/repositories/customer.repository";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as userRepo from "@/lib/repositories/user.repository";
import * as deviceRepo from "@/lib/repositories/device.repository";
import type { CashierSession, Order } from "@/lib/types";
import { getSessionById } from "@/modules/sessions/services/session.service";

export interface SessionInvoiceRow extends Order {
  customerName: string | null;
  hasCustomer: boolean;
}

export interface SessionDetail {
  session: CashierSession;
  storeName: string;
  cashierName: string;
  deviceName: string | null;
  closedByName: string | null;
  invoices: SessionInvoiceRow[];
  orderCount: number;
  totalSales: number;
  invoicesWithCustomer: number;
}

export async function getSessionDetail(
  sessionId: string,
  options?: { storeId?: string | null; canViewAll?: boolean }
): Promise<SessionDetail | null> {
  const session = await getSessionById(sessionId);
  if (!session) return null;

  if (!options?.canViewAll && options?.storeId && session.store_id !== options.storeId) {
    return null;
  }

  const [orders, store, users, devices] = await Promise.all([
    orderRepo.listOrdersBySessionIds([sessionId]),
    storeRepo.getStore(session.store_id),
    userRepo.listUsers(),
    deviceRepo.listDevices(),
  ]);

  const customerIds = orders
    .map((order) => order.customer_id)
    .filter((id): id is string => Boolean(id));
  const customers = await customerRepo.getCustomersByIds(customerIds);
  const customerMap = new Map(customers.map((c) => [c.id, c.name]));
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const deviceMap = new Map(devices.map((d) => [d.id, d.name]));

  const invoices: SessionInvoiceRow[] = orders.map((order) => ({
    ...order,
    hasCustomer: Boolean(order.customer_id),
    customerName: order.customer_id
      ? (customerMap.get(order.customer_id) ?? null)
      : null,
  }));

  const completed = invoices.filter((order) => order.status === "completed");

  return {
    session,
    storeName: store?.name ?? "الفرع",
    cashierName: userMap.get(session.cashier_id) ?? "الكاشير",
    deviceName: session.device_id
      ? (deviceMap.get(session.device_id) ?? null)
      : null,
    closedByName: session.closed_by
      ? (userMap.get(session.closed_by) ?? null)
      : null,
    invoices,
    orderCount: completed.length,
    totalSales: completed.reduce((sum, order) => sum + order.total, 0),
    invoicesWithCustomer: invoices.filter((order) => order.hasCustomer).length,
  };
}
