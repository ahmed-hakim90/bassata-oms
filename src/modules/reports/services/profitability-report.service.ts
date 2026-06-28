import * as orderRepo from "@/lib/repositories/order.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import { getDb } from "@/lib/repositories/client";

export interface ProductProfitRow {
  productId: string;
  name: string;
  quantitySold: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

function getNetLineRevenue(
  item: { order_id: string; line_total: number | string | null },
  revenueFactors: Map<string, number>
) {
  const grossLineTotal = Number(item.line_total ?? 0);
  const factor = revenueFactors.get(item.order_id);
  if (!factor || factor <= 0) return grossLineTotal;
  return grossLineTotal * factor;
}

export async function getProductProfitabilityReport(options?: {
  storeId?: string;
  days?: number;
  from?: string;
  to?: string;
}): Promise<ProductProfitRow[]> {
  const days = options?.days ?? 30;
  let rangeStart: Date;
  let rangeEnd: Date;
  if (options?.from) {
    rangeStart = new Date(options.from);
    rangeEnd = options.to ? new Date(`${options.to}T23:59:59`) : new Date();
  } else {
    rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - days);
    rangeEnd = new Date();
  }

  const orders = (await orderRepo.listOrders(options?.storeId)).filter(
    (o) =>
      o.status === "completed" &&
      o.payment_status !== "unpaid" &&
      new Date(o.created_at) >= rangeStart &&
      new Date(o.created_at) <= rangeEnd
  );

  const db = await getDb();
  const orderIds = orders.map((o) => o.id);
  const { data: items } =
    orderIds.length > 0
      ? await db.from("order_items").select("*").in("order_id", orderIds)
      : { data: [] };

  const products = await catalogRepo.listProducts({ productType: "finished" });
  const productMap = new Map(products.map((p) => [p.id, p.name]));
  const revenueFactorByOrder = new Map(
    orders.map((order) => [
      order.id,
      order.subtotal > 0 ? order.total / order.subtotal : 0,
    ])
  );

  const stats = new Map<
    string,
    { quantitySold: number; revenue: number; cost: number }
  >();

  for (const item of items ?? []) {
    const existing = stats.get(item.product_id) ?? {
      quantitySold: 0,
      revenue: 0,
      cost: 0,
    };
    existing.quantitySold += item.quantity;
    existing.revenue += getNetLineRevenue(item, revenueFactorByOrder);
    existing.cost += Number(item.line_cost ?? 0);
    stats.set(item.product_id, existing);
  }

  return [...stats.entries()]
    .map(([productId, data]) => {
      const profit = data.revenue - data.cost;
      return {
        productId,
        name: productMap.get(productId) ?? "Unknown",
        quantitySold: data.quantitySold,
        revenue: data.revenue,
        cost: data.cost,
        profit,
        margin: data.revenue > 0 ? (profit / data.revenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.profit - a.profit);
}
