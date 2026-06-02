import { getCurrentUser } from "@/lib/auth/session";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as userRepo from "@/lib/repositories/user.repository";
import * as deviceRepo from "@/lib/repositories/device.repository";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import { getProfitReport } from "@/modules/reports/services/profit-report.service";

export interface OrgOverviewStats {
  organizationName: string;
  currency: string;
  storeCount: number;
  activeStoreCount: number;
  activeUsers: number;
  activeDevices: number;
  todaySales: number;
  inventoryValue: number;
  monthlyProfit: number;
}

async function getAccessibleStoreIds(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const stores = await storeRepo.listStores();
  if (user.role === "owner" || user.role === "manager") {
    return stores.map((s) => s.id);
  }
  return stores.filter((s) => user.store_ids.includes(s.id)).map((s) => s.id);
}

export async function getOrgOverviewStats(): Promise<OrgOverviewStats> {
  const { getOrganization } = await import("@/lib/repositories/organization.repository");
  const org = await getOrganization();
  const stores = await storeRepo.listStores();
  const accessibleStoreIds = await getAccessibleStoreIds();
  const accessibleStores = stores.filter((s) => accessibleStoreIds.includes(s.id));

  const users = await userRepo.listUsers();
  const devices = await deviceRepo.listDevices();
  const accessibleDevices = devices.filter(
    (d) => accessibleStoreIds.includes(d.store_id) && d.is_active
  );

  const todayPrefix = new Date().toISOString().slice(0, 10);
  let todaySales = 0;
  for (const storeId of accessibleStoreIds) {
    const orders = (await orderRepo.listOrders(storeId)).filter(
      (o) => o.status === "completed" && o.created_at.startsWith(todayPrefix)
    );
    todaySales += orders.reduce((sum, o) => sum + o.total, 0);
  }

  const products = await catalogRepo.listProducts();
  const productPriceMap = new Map(products.map((p) => [p.id, p.base_price]));
  let inventoryValue = 0;
  for (const storeId of accessibleStoreIds) {
    const levels = await inventoryRepo.listStockLevels(storeId);
    for (const level of levels) {
      const price = productPriceMap.get(level.product_id) ?? 0;
      inventoryValue += level.quantity * price;
    }
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  const from = monthStart.toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);

  let monthlyProfit = 0;
  for (const storeId of accessibleStoreIds) {
    const profit = await getProfitReport({ storeId, from, to });
    monthlyProfit += profit.estimatedNetProfit;
  }

  return {
    organizationName: org.name,
    currency: org.currency,
    storeCount: accessibleStores.length,
    activeStoreCount: accessibleStores.filter((s) => s.is_active).length,
    activeUsers: users.filter((u) => u.is_active).length,
    activeDevices: accessibleDevices.length,
    todaySales,
    inventoryValue,
    monthlyProfit,
  };
}
