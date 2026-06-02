import { getValidatedActiveStoreId } from "@/lib/auth/guards";
import { getPosReadiness } from "@/lib/auth/pos-readiness";
import { PosScreen } from "@/modules/pos/components/pos-screen";
import {
  getCategoriesForPOS,
  getProductsForPOS,
} from "@/modules/pos/services/catalog.service";
import { getActiveSession } from "@/modules/sessions/services/session.service";
import {
  getExpenseSettings,
  getFeatureFlags,
  getSessionSettings,
} from "@/modules/system/services/settings.service";
import { getCurrentUser } from "@/lib/auth/session";
import { listCostCenters } from "@/modules/accounting/services/cost-center.service";
import { listExpenseCategories } from "@/modules/accounting/services/expense-category.service";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as permissionRepo from "@/lib/repositories/permission.repository";
import type { PaymentMethod } from "@/lib/types";

export default async function PosPage() {
  const storeId = await getValidatedActiveStoreId();
  const readiness = await getPosReadiness();
  const categories = await getCategoriesForPOS();
  const products = await getProductsForPOS(storeId);
  const session =
    readiness.cashierId && readiness.state !== "login_required"
      ? await getActiveSession(storeId, readiness.cashierId)
      : null;
  const flags = await getFeatureFlags();
  const expenseSettings = await getExpenseSettings();
  const sessionSettings = await getSessionSettings();
  const user = await getCurrentUser();
  const enabledPaymentMethods: PaymentMethod[] = [
    flags.payment_cash ? "cash" : null,
    flags.payment_card ? "card" : null,
    flags.payment_wallet ? "wallet" : null,
    flags.payment_other ? "other" : null,
    flags.credit_sales ? "credit" : null,
  ].filter((method): method is PaymentMethod => Boolean(method));

  const [costCenters, expenseCategories, allProducts] = await Promise.all([
    listCostCenters(storeId),
    listExpenseCategories(),
    catalogRepo.listProducts(),
  ]);
  const inventoryProducts = allProducts.filter((p) => p.track_inventory);

  const canAddSessionExpense =
    flags.session_expenses &&
    expenseSettings.cashier_can_add_session_expense &&
    Boolean(session) &&
    (await permissionRepo.hasPermission("session_expense_create"));

  return (
    <PosScreen
      categories={categories}
      initialProducts={products}
      hasActiveSession={Boolean(session)}
      enabledPaymentMethods={enabledPaymentMethods}
      readinessState={readiness.state}
      sessionId={session?.id ?? null}
      cashierId={readiness.cashierId}
      storeId={storeId}
      costCenters={costCenters}
      expenseCategories={expenseCategories}
      inventoryProducts={inventoryProducts}
      expenseSettings={expenseSettings}
      canAddSessionExpense={canAddSessionExpense}
      featureFlags={flags}
      canManagerOverride={user?.role === "owner" || user?.role === "manager"}
      managerDiscountOverrideAmount={sessionSettings.manager_discount_override_amount}
    />
  );
}
