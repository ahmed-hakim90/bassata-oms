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
  const [user, storeId, readiness] = await Promise.all([
    getCurrentUser(),
    getValidatedActiveStoreId(),
    getPosReadiness(),
  ]);

  const [
    storeDevices,
    categories,
    products,
    session,
    flags,
    expenseSettings,
    sessionSettings,
    costCenters,
    expenseCategories,
    allProducts,
    receiptBranding,
    onlineOrders,
    onlineOrderProducts,
    allStores,
  ] = await Promise.all([
    readiness.state === "no_device"
      ? deviceRepo.listDevices(storeId).then((devices) => devices.filter((d) => d.is_active))
      : Promise.resolve([] as Awaited<ReturnType<typeof deviceRepo.listDevices>>),
    getCategoriesForPOS(),
    getProductsForPOS(storeId),
    readiness.cashierId && readiness.state !== "login_required"
      ? getActiveSession(storeId, readiness.cashierId)
      : Promise.resolve(null),
    getFeatureFlags(),
    getExpenseSettings(),
    getSessionSettings(),
    listCostCenters(storeId),
    listExpenseCategories(),
    catalogRepo.listProducts(),
    getReportBranding(storeId),
    listOnlineOrdersWithItems(storeId),
    listStaffOnlineProductOptions(),
    storeRepo.listStores(),
  ]);

  const enabledPaymentMethods: PaymentMethod[] = [
    flags.payment_cash ? "cash" : null,
    flags.payment_card ? "card" : null,
    flags.payment_wallet ? "wallet" : null,
    flags.payment_other ? "other" : null,
    flags.credit_sales ? "credit" : null,
  ].filter((method): method is PaymentMethod => Boolean(method));

  const inventoryProducts = allProducts.filter((p) => p.track_inventory);
  const stores =
    user?.role === "owner" || user?.role === "manager"
      ? allStores
      : allStores.filter((store) => user?.store_ids.includes(store.id) ?? false);
  const costCenterMap = new Map(costCenters.map((center) => [center.id, center.name]));
  const expenseCategoryMap = new Map(
    expenseCategories.map((category) => [category.id, category.name])
  );

  const [
    sessionReconciliation,
    sessionExpenses,
    loyaltyRule,
    canAddSessionExpensePerm,
    canCollectPaymentPerm,
    cashier,
  ] = await Promise.all([
    session ? calcExpectedCash(session.id) : Promise.resolve(null),
    session ? listExpenses(storeId, session.id) : Promise.resolve([]),
    flags.loyalty ? getLoyaltyRule() : Promise.resolve(null),
    flags.session_expenses &&
    expenseSettings.cashier_can_add_session_expense &&
    Boolean(session)
      ? permissionRepo.hasPermission("session_expense_create")
      : Promise.resolve(false),
    user?.role === "owner" || user?.role === "manager"
      ? Promise.resolve(true)
      : permissionRepo.hasPermission("customer_payment_receive"),
    session ? userRepo.getUser(session.cashier_id) : Promise.resolve(null),
  ]);

  const loyaltyRedemptionRate =
    loyaltyRule?.is_active && loyaltyRule.redemption_rate > 0
      ? loyaltyRule.redemption_rate
      : null;
  const minimumLoyaltyRedeemPoints = loyaltyRule?.is_active
    ? loyaltyRule.minimum_redeem_points
    : 0;

  const canAddSessionExpense = Boolean(canAddSessionExpensePerm);
  const canCollectPayment = Boolean(canCollectPaymentPerm);

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
      canCollectPayment={canCollectPayment}
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
      cashierName={cashier?.name ?? null}
      costCenterMap={costCenterMap}
      expenseCategoryMap={expenseCategoryMap}
      storeDevices={storeDevices}
    />
  );
}
