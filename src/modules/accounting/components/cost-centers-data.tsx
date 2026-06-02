import { getValidatedActiveStoreId, requirePermission } from "@/lib/auth/guards";
import { listCostCenters } from "@/modules/accounting/services/cost-center.service";
import { listExpenseCategories } from "@/modules/accounting/services/expense-category.service";
import { CostCentersPage } from "@/modules/accounting/components/cost-centers-page";

export async function getCostCentersPageData() {
  await requirePermission("cost_center_manage");
  const storeId = await getValidatedActiveStoreId();
  const [centers, categories] = await Promise.all([
    listCostCenters(storeId),
    listExpenseCategories(),
  ]);
  return { centers, categories };
}

export { CostCentersPage };
