import { orderBusinessAt } from "@/lib/document-date";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as orgRepo from "@/lib/repositories/organization.repository";

export interface TaxDayRow {
  date: string;
  orderCount: number;
  taxableBase: number;
  tax: number;
  total: number;
}

export interface TaxOrderRow {
  id: string;
  orderNumber: string;
  storeName: string;
  createdAt: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export interface TaxReport {
  taxRate: number;
  taxInclusive: boolean;
  taxEnabled: boolean;
  summary: {
    orderCount: number;
    taxableBase: number;
    taxCollected: number;
    grossSales: number;
  };
  byDay: TaxDayRow[];
  orders: TaxOrderRow[];
}

/**
 * Tax basics: sum `orders.tax` / subtotal / total for completed paid orders.
 * Rate/inclusive flags come from org settings (display only).
 */
export async function getTaxReport(options: {
  storeId?: string;
  from: Date;
  to: Date;
}): Promise<TaxReport> {
  const [org, stores, orders] = await Promise.all([
    orgRepo.getOrganization(),
    storeRepo.listStores(),
    orderRepo.listOrders(options.storeId),
  ]);
  const storeMap = new Map(stores.map((s) => [s.id, s.name]));
  const settings = org.settings ?? {};
  const taxRate = Number(settings.tax_rate ?? 0);
  const taxInclusive = Boolean(settings.tax_inclusive ?? true);
  const taxEnabled = Boolean(settings.tax_enabled ?? taxRate > 0);

  const filtered = orders.filter((o) => {
    if (o.status !== "completed") return false;
    if (o.payment_status === "unpaid") return false;
    const at = new Date(orderBusinessAt(o)).getTime();
    return at >= options.from.getTime() && at <= options.to.getTime();
  });

  const byDayMap = new Map<string, TaxDayRow>();
  let taxableBase = 0;
  let taxCollected = 0;
  let grossSales = 0;

  const orderRows: TaxOrderRow[] = filtered.map((o) => {
    const businessAt = orderBusinessAt(o);
    const day = businessAt.slice(0, 10);
    const dayRow = byDayMap.get(day) ?? {
      date: day,
      orderCount: 0,
      taxableBase: 0,
      tax: 0,
      total: 0,
    };
    dayRow.orderCount += 1;
    dayRow.taxableBase += o.subtotal - o.discount;
    dayRow.tax += o.tax;
    dayRow.total += o.total;
    byDayMap.set(day, dayRow);

    taxableBase += o.subtotal - o.discount;
    taxCollected += o.tax;
    grossSales += o.total;

    return {
      id: o.id,
      orderNumber: o.order_number,
      storeName: storeMap.get(o.store_id) ?? "—",
      createdAt: businessAt,
      subtotal: o.subtotal,
      discount: o.discount,
      tax: o.tax,
      total: o.total,
    };
  });

  const byDay = [...byDayMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  return {
    taxRate,
    taxInclusive,
    taxEnabled,
    summary: {
      orderCount: filtered.length,
      taxableBase,
      taxCollected,
      grossSales,
    },
    byDay,
    orders: orderRows,
  };
}
