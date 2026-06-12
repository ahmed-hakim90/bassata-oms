import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getEffectivePermissions } from "@/lib/repositories/permission.repository";
import { listStores } from "@/modules/system/services/users.service";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import { WarehousesManager } from "@/modules/inventory/components/warehouses-manager";

export default async function WarehousesRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?from=/inventory/warehouses");
  const permissions = await getEffectivePermissions(user);
  if (user.role !== "owner" && !permissions.has("settings_manage")) redirect("/");

  const [stores, warehouses] = await Promise.all([
    listStores(),
    warehouseRepo.listWarehouses(),
  ]);
  return (
    <WarehousesManager stores={stores.filter((s) => s.is_active)} warehouses={warehouses} />
  );
}
