import { getValidatedActiveStoreId } from "@/lib/auth/guards";
import { getPosReadiness } from "@/lib/auth/pos-readiness";
import type { PosReadinessState } from "@/lib/auth/pos-readiness-copy";
import { PosScreen } from "@/modules/pos/components/pos-screen";
import { getActiveSession } from "@/modules/sessions/services/session.service";
import { getPendingOpeningFloat } from "@/modules/sessions/services/cashier-vault.service";
import {
  getExpenseSettings,
  getFeatureFlags,
  getSessionSettings,
  getBusinessActivitySettings,
} from "@/modules/system/services/settings.service";
import { DEFAULT_BUSINESS_ACTIVITY_SETTINGS } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth/session";
import { getLoyaltyRule } from "@/modules/loyalty/services/loyalty.service";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";
import { listHeldCartsForPosDevice } from "@/modules/pos/services/held-cart.service";
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

async function settled<T>(promise: Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    console.error(`[pos] ${label} failed; using fallback`, error);
    return fallback;
  }
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
        loadCatalogClient
      />
    );
  }

  // Catalog + online orders load on the client (API) so RSC remounts stay light.
  const [
    session,
    flags,
    expenseSettings,
    sessionSettings,
    businessActivity,
    costCenters,
    expenseCategories,
    receiptBranding,
    allStores,
    initialHeldCarts,
  ] = await Promise.all([
    readiness.cashierId
      ? settled(getActiveSession(storeId, readiness.cashierId), null, "session")
      : Promise.resolve(null),
    getFeatureFlags(),
    settled(
      getExpenseSettings(),
      {
        approval_required: false,
        cashier_can_add_session_expense: false,
        cashier_max_expense_amount: null,
        allow_inventory_purchase_from_session: true,
        default_cost_center_packaging: null,
        default_cost_center_cleaning: null,
        default_cost_center_utilities: null,
        prevent_expenses_in_closed_periods: true,
      },
      "expenseSettings"
    ),
    getSessionSettings(),
    settled(getBusinessActivitySettings(), DEFAULT_BUSINESS_ACTIVITY_SETTINGS, "businessActivity"),
    settled(listCostCenters(storeId), [], "costCenters"),
    settled(listExpenseCategories(), [], "expenseCategories"),
    settled(
      getReportBranding(storeId),
      {
        orgName: "SweetFlow",
        orgLogoUrl: null,
        currency: "EGP",
        storeName: null,
        storeAddress: null,
        storePhone: null,
        receiptHeader: null,
        receiptFooter: null,
      },
      "receiptBranding"
    ),
    settled(storeRepo.listStores(), [], "stores"),
    readiness.deviceId
      ? settled(
          listHeldCartsForPosDevice({ storeId, deviceId: readiness.deviceId }),
          [],
          "heldCarts"
        )
      : Promise.resolve([]),
  ]);

  const needsInventoryProducts =
    flags.session_expenses &&
    expenseSettings.cashier_can_add_session_expense &&
    Boolean(session);

  const allProducts: Product[] = needsInventoryProducts
    ? await settled(catalogRepo.listProducts(), [], "inventoryProducts")
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
    session
      ? settled(loadSessionCashBundle(session.id), null, "sessionCashBundle")
      : Promise.resolve(null),
    flags.loyalty ? settled(getLoyaltyRule(), null, "loyaltyRule") : Promise.resolve(null),
    needsInventoryProducts
      ? settled(permissionRepo.hasPermission("session_expense_create"), false, "expensePerm")
      : Promise.resolve(false),
    user?.role === "owner" || user?.role === "manager"
      ? Promise.resolve(true)
      : settled(permissionRepo.hasPermission("customer_payment_receive"), false, "collectPerm"),
    session ? settled(userRepo.getUser(session.cashier_id), null, "cashier") : Promise.resolve(null),
    !session && readiness.cashierId
      ? settled(getPendingOpeningFloat(storeId, readiness.cashierId), 0, "pendingFloat")
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

  return (
    <PosScreen
      categories={[]}
      initialProducts={[]}
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
      canAddSessionExpense={Boolean(canAddSessionExpensePerm)}
      featureFlags={flags}
      canManagerOverride={user?.role === "owner" || user?.role === "manager"}
      canCollectPayment={Boolean(canCollectPaymentPerm)}
      managerDiscountOverrideAmount={sessionSettings.manager_discount_override_amount}
      currentUserName={user?.name ?? null}
      loyaltyRedemptionRate={loyaltyRedemptionRate}
      minimumLoyaltyRedeemPoints={minimumLoyaltyRedeemPoints}
      receiptBranding={receiptBranding}
      onlineOrders={[]}
      onlineOrderProducts={[]}
      stores={stores}
      activeSession={session}
      sessionReconciliation={sessionReconciliation}
      sessionExpenses={sessionExpenses}
      cashierName={cashier?.name ?? null}
      costCenterMap={costCenterMap}
      expenseCategoryMap={expenseCategoryMap}
      storeDevices={[]}
      pendingOpeningFloat={pendingOpeningFloat}
      loadCatalogClient
      enableVariants={businessActivity.enable_variants !== false}
      initialHeldCarts={initialHeldCarts}
    />
  );
}
