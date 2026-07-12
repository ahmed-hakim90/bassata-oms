import { getValidatedActiveStoreId } from "@/lib/auth/guards";
import { getPosReadiness } from "@/lib/auth/pos-readiness";
import type { PosReadinessState } from "@/lib/auth/pos-readiness-copy";
import { PosScreen } from "@/modules/pos/components/pos-screen";
import {
  getCategoriesForPOS,
  getProductsForPOS,
  type POSProduct,
} from "@/modules/pos/services/catalog.service";
import { getActiveSession } from "@/modules/sessions/services/session.service";
import { getPendingOpeningFloat } from "@/modules/sessions/services/cashier-vault.service";
import {
  getExpenseSettings,
  getFeatureFlags,
  getSessionSettings,
} from "@/modules/system/services/settings.service";
import { getCurrentUser } from "@/lib/auth/session";
import { getLoyaltyRule } from "@/modules/loyalty/services/loyalty.service";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";
import {
  listActiveOnlineOrdersWithItems,
  type StaffOnlineProductOption,
} from "@/modules/online-orders/services/online-order.service";
import { listCostCenters } from "@/modules/accounting/services/cost-center.service";
import { listExpenseCategories } from "@/modules/accounting/services/expense-category.service";
import { loadSessionCashBundle } from "@/modules/sessions/services/reconciliation.service";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as userRepo from "@/lib/repositories/user.repository";
import * as deviceRepo from "@/lib/repositories/device.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as permissionRepo from "@/lib/repositories/permission.repository";
import type { PaymentMethod, Product } from "@/lib/types";

/** Gate screens that must not pay for catalog / online-orders / session extras. */
const GATE_ONLY_STATES = new Set<PosReadinessState>([
  "login_required",
  "no_device",
  "device_inactive",
  "store_mismatch",
  "store_required",
  "access_denied",
  "role_denied",
  "cashier_required",
]);

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function toStaffOnlineProductOptions(products: POSProduct[]): StaffOnlineProductOption[] {
  return products
    .filter(
      (product) =>
        product.product_type === "finished" &&
        product.inventory_product_type === "finished_product" &&
        (product.sale_price ?? product.base_price) > 0
    )
    .map((product) => ({
      id: product.id,
      name: product.name,
      price: money(product.sale_price ?? product.base_price),
      variants: product.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        price: money(variant.price),
      })),
    }));
}

export default async function PosPage() {
  const [user, storeId, readiness] = await Promise.all([
    getCurrentUser(),
    getValidatedActiveStoreId(),
    getPosReadiness(),
  ]);

  if (GATE_ONLY_STATES.has(readiness.state)) {
    const [storeDevices, allStores, flags, receiptBranding] = await Promise.all([
      readiness.state === "no_device"
        ? deviceRepo.listDevices(storeId).then((devices) => devices.filter((d) => d.is_active))
        : Promise.resolve([] as Awaited<ReturnType<typeof deviceRepo.listDevices>>),
      readiness.state === "store_required" || readiness.state === "store_mismatch"
        ? storeRepo.listStores()
        : Promise.resolve([] as Awaited<ReturnType<typeof storeRepo.listStores>>),
      getFeatureFlags(),
      getReportBranding(storeId),
    ]);

    const enabledPaymentMethods: PaymentMethod[] = [
      flags.payment_cash ? "cash" : null,
      flags.payment_card ? "card" : null,
      flags.payment_wallet ? "wallet" : null,
      flags.payment_other ? "other" : null,
      flags.credit_sales ? "credit" : null,
    ].filter((method): method is PaymentMethod => Boolean(method));

    const stores =
      user?.role === "owner" || user?.role === "manager"
        ? allStores
        : allStores.filter((store) => user?.store_ids.includes(store.id) ?? false);

    return (
      <PosScreen
        categories={[]}
        initialProducts={[]}
        hasActiveSession={false}
        enabledPaymentMethods={enabledPaymentMethods}
        readinessState={readiness.state}
        sessionId={null}
        cashierId={readiness.cashierId}
        storeId={storeId}
        receiptBranding={receiptBranding}
        stores={stores}
        storeDevices={storeDevices}
        featureFlags={flags}
        canManagerOverride={user?.role === "owner" || user?.role === "manager"}
        currentUserName={user?.name ?? null}
      />
    );
  }

  const [
    categories,
    products,
    session,
    flags,
    expenseSettings,
    sessionSettings,
    costCenters,
    expenseCategories,
    receiptBranding,
    onlineOrders,
    allStores,
  ] = await Promise.all([
    getCategoriesForPOS(),
    getProductsForPOS(storeId),
    readiness.cashierId
      ? getActiveSession(storeId, readiness.cashierId)
      : Promise.resolve(null),
    getFeatureFlags(),
    getExpenseSettings(),
    getSessionSettings(),
    listCostCenters(storeId),
    listExpenseCategories(),
    getReportBranding(storeId),
    listActiveOnlineOrdersWithItems(storeId),
    storeRepo.listStores(),
  ]);

  const onlineOrderProducts = toStaffOnlineProductOptions(products);

  const needsInventoryProducts =
    flags.session_expenses &&
    expenseSettings.cashier_can_add_session_expense &&
    Boolean(session);

  const allProducts: Product[] = needsInventoryProducts
    ? await catalogRepo.listProducts()
    : [];

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
  const costCenterMap = Object.fromEntries(costCenters.map((center) => [center.id, center.name]));
  const expenseCategoryMap = Object.fromEntries(
    expenseCategories.map((category) => [category.id, category.name])
  );

  const [
    sessionCashBundle,
    loyaltyRule,
    canAddSessionExpensePerm,
    canCollectPaymentPerm,
    cashier,
    pendingOpeningFloat,
  ] = await Promise.all([
    session ? loadSessionCashBundle(session.id) : Promise.resolve(null),
    flags.loyalty ? getLoyaltyRule() : Promise.resolve(null),
    needsInventoryProducts
      ? permissionRepo.hasPermission("session_expense_create")
      : Promise.resolve(false),
    user?.role === "owner" || user?.role === "manager"
      ? Promise.resolve(true)
      : permissionRepo.hasPermission("customer_payment_receive"),
    session ? userRepo.getUser(session.cashier_id) : Promise.resolve(null),
    !session && readiness.cashierId
      ? getPendingOpeningFloat(storeId, readiness.cashierId)
      : Promise.resolve(0),
  ]);

  const sessionReconciliation = sessionCashBundle?.reconciliation ?? null;
  const sessionExpenses = sessionCashBundle?.expenses ?? [];

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
      storeDevices={[]}
      pendingOpeningFloat={pendingOpeningFloat}
    />
  );
}
