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
import { getLoyaltyRule } from "@/modules/loyalty/services/loyalty.service";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";
import {
  listOnlineOrdersWithItems,
  listStaffOnlineProductOptions,
} from "@/modules/online-orders/services/online-order.service";
import { listCostCenters } from "@/modules/accounting/services/cost-center.service";
import { listExpenseCategories } from "@/modules/accounting/services/expense-category.service";
import { calcExpectedCash } from "@/modules/sessions/services/reconciliation.service";
import { listExpenses } from "@/modules/expenses/services/expense.service";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as userRepo from "@/lib/repositories/user.repository";
import * as deviceRepo from "@/lib/repositories/device.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as permissionRepo from "@/lib/repositories/permission.repository";
import type { PaymentMethod } from "@/lib/types";

export default async function PosPage() {
  const user = await getCurrentUser();
  const storeId = await getValidatedActiveStoreId();

  const readiness = await getPosReadiness();
  const storeDevices =
    readiness.state === "no_device"
      ? (await deviceRepo.listDevices(storeId)).filter((device) => device.is_active)
      : [];
  const categories = await getCategoriesForPOS();
  const products = await getProductsForPOS(storeId);
  const session =
    readiness.cashierId && readiness.state !== "login_required"
      ? await getActiveSession(storeId, readiness.cashierId)
      : null;
  const flags = await getFeatureFlags();
  const expenseSettings = await getExpenseSettings();
  const sessionSettings = await getSessionSettings();
  const enabledPaymentMethods: PaymentMethod[] = [
    flags.payment_cash ? "cash" : null,
    flags.payment_card ? "card" : null,
    flags.payment_wallet ? "wallet" : null,
    flags.payment_other ? "other" : null,
    flags.credit_sales ? "credit" : null,
  ].filter((method): method is PaymentMethod => Boolean(method));

  const [
    costCenters,
    expenseCategories,
    allProducts,
    receiptBranding,
    onlineOrders,
    onlineOrderProducts,
    allStores,
    users,
  ] = await Promise.all([
    listCostCenters(storeId),
    listExpenseCategories(),
    catalogRepo.listProducts(),
    getReportBranding(storeId),
    listOnlineOrdersWithItems(storeId),
    listStaffOnlineProductOptions(),
    storeRepo.listStores(),
    userRepo.listUsers(),
  ]);
  const inventoryProducts = allProducts.filter((p) => p.track_inventory);
  const stores =
    user?.role === "owner" || user?.role === "manager"
      ? allStores
      : allStores.filter((store) => user?.store_ids.includes(store.id) ?? false);
  const costCenterMap = new Map(costCenters.map((center) => [center.id, center.name]));
  const expenseCategoryMap = new Map(expenseCategories.map((category) => [category.id, category.name]));
  const userMap = new Map(users.map((entry) => [entry.id, entry.name]));

  const [sessionReconciliation, sessionExpenses] = session
    ? await Promise.all([calcExpectedCash(session.id), listExpenses(storeId, session.id)])
    : [null, []];

  const loyaltyRule = flags.loyalty ? await getLoyaltyRule() : null;
  const loyaltyRedemptionRate =
    loyaltyRule?.is_active && loyaltyRule.redemption_rate > 0
      ? loyaltyRule.redemption_rate
      : null;
  const minimumLoyaltyRedeemPoints =
    loyaltyRule?.is_active ? loyaltyRule.minimum_redeem_points : 0;

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
      currentUserName={user?.name ?? null}
      loyaltyRedemptionRate={loyaltyRedemptionRate}
      minimumLoyaltyRedeemPoints={minimumLoyaltyRedeemPoints}
      receiptBranding={receiptBranding}
      onlineOrders={onlineOrders}
      onlineOrderProducts={onlineOrderProducts}
      stores={stores}
      activeSession={session}
      sessionReconciliation={sessionReconciliation}
      sessionExpenses={sessionExpenses}
      cashierName={session ? userMap.get(session.cashier_id) ?? null : null}
      costCenterMap={costCenterMap}
      expenseCategoryMap={expenseCategoryMap}
      storeDevices={storeDevices}
    />
  );
}
