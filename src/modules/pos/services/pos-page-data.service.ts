import { AuthError, getValidatedActiveStoreId } from "@/lib/auth/guards";
import { getPosReadiness } from "@/lib/auth/pos-readiness";
import type { PosReadinessState } from "@/lib/auth/pos-readiness-copy";
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
import { listActivePromotionRulesForEval } from "@/lib/repositories/promotion.repository";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";
import { listHeldCartsForPosDevice } from "@/modules/pos/services/held-cart.service";
import { listCostCenters } from "@/modules/accounting/services/cost-center.service";
import { listExpenseCategories } from "@/modules/accounting/services/expense-category.service";
import { loadSessionCashBundle } from "@/modules/sessions/services/reconciliation.service";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as userRepo from "@/lib/repositories/user.repository";
import * as deviceRepo from "@/lib/repositories/device.repository";
import * as permissionRepo from "@/lib/repositories/permission.repository";
import { enabledPaymentMethodsFromFlags } from "@/lib/enabled-payment-methods";

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

async function resolvePosStoreId(preferred: string | null): Promise<string | null> {
  if (preferred) return preferred;
  try {
    return await getValidatedActiveStoreId();
  } catch (error) {
    // Auth/store gates are handled by PosReadiness — never crash the POS RSC shell.
    if (error instanceof AuthError) return null;
    throw error;
  }
}

export async function getPosPageData() {
  const [user, readiness] = await Promise.all([getCurrentUser(), getPosReadiness()]);
  const storeId = await resolvePosStoreId(readiness.storeId);

  if (GATE_ONLY_STATES.has(readiness.state) || !storeId) {
    const effectiveGate: PosReadinessState =
      !user || readiness.state === "login_required"
        ? "login_required"
        : GATE_ONLY_STATES.has(readiness.state)
          ? readiness.state
          : "store_required";

    const [storeDevices, allStores, flags, receiptBranding] = await Promise.all([
      effectiveGate === "no_device" && storeId
        ? deviceRepo.listDevices(storeId).then((devices) => devices.filter((d) => d.is_active))
        : Promise.resolve([] as Awaited<ReturnType<typeof deviceRepo.listDevices>>),
      effectiveGate === "store_required" || effectiveGate === "store_mismatch"
        ? storeRepo.listStores()
        : Promise.resolve([] as Awaited<ReturnType<typeof storeRepo.listStores>>),
      getFeatureFlags(),
      storeId
        ? getReportBranding(storeId)
        : Promise.resolve({
            orgName: "Velora",
            orgLogoUrl: null,
            currency: "EGP",
            storeName: null,
            storeAddress: null,
            storePhone: null,
            receiptHeader: null,
            receiptFooter: null,
          }),
    ]);

    const enabledPaymentMethods = enabledPaymentMethodsFromFlags(flags);

    const stores =
      user?.role === "owner" || user?.role === "manager"
        ? allStores
        : allStores.filter((store) => user?.store_ids.includes(store.id) ?? false);

    return {
      categories: [],
      initialProducts: [],
      hasActiveSession: false,
      enabledPaymentMethods,
      readinessState: effectiveGate,
      sessionId: null,
      cashierId: readiness.cashierId,
      storeId: storeId ?? "",
      receiptBranding,
      stores,
      storeDevices,
      featureFlags: flags,
      canManagerOverride: user?.role === "owner" || user?.role === "manager",
      currentUserName: user?.name ?? null,
      loadCatalogClient: true,
    };
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
        allow_inventory_purchase_from_session: false,
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
        orgName: "Velora",
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

  const canRequestSessionExpense =
    flags.session_expenses &&
    expenseSettings.cashier_can_add_session_expense &&
    Boolean(session);

  const enabledPaymentMethods = enabledPaymentMethodsFromFlags(flags);

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
    promotionRules,
    canAddSessionExpensePerm,
    canCollectPaymentPerm,
    canPaySupplierPerm,
    cashier,
    pendingOpeningFloat,
  ] = await Promise.all([
    session
      ? settled(loadSessionCashBundle(session.id), null, "sessionCashBundle")
      : Promise.resolve(null),
    flags.loyalty ? settled(getLoyaltyRule(), null, "loyaltyRule") : Promise.resolve(null),
    flags.promotions
      ? settled(listActivePromotionRulesForEval(), [], "promotionRules")
      : Promise.resolve([]),
    canRequestSessionExpense
      ? settled(permissionRepo.hasPermission("session_expense_create"), false, "expensePerm")
      : Promise.resolve(false),
    user?.role === "owner" || user?.role === "manager"
      ? Promise.resolve(true)
      : settled(permissionRepo.hasPermission("customer_payment_receive"), false, "collectPerm"),
    flags.purchases
      ? user?.role === "owner" || user?.role === "manager"
        ? Promise.resolve(true)
        : settled(permissionRepo.hasPermission("supplier_payment_record"), false, "supplierPayPerm")
      : Promise.resolve(false),
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

  return {
    categories: [],
    initialProducts: [],
    hasActiveSession: Boolean(session),
    enabledPaymentMethods,
    readinessState: readiness.state,
    sessionId: session?.id ?? null,
    cashierId: readiness.cashierId,
    storeId,
    costCenters,
    expenseCategories,
    canAddSessionExpense: Boolean(canAddSessionExpensePerm),
    featureFlags: flags,
    canManagerOverride: user?.role === "owner" || user?.role === "manager",
    canCollectPayment: Boolean(canCollectPaymentPerm),
    canPaySupplier: Boolean(canPaySupplierPerm),
    managerDiscountOverrideAmount: sessionSettings.manager_discount_override_amount,
    currentUserName: user?.name ?? null,
    loyaltyRedemptionRate,
    minimumLoyaltyRedeemPoints,
    promotionRules,
    receiptBranding,
    onlineOrders: [],
    onlineOrderProducts: [],
    stores,
    activeSession: session,
    sessionReconciliation,
    sessionExpenses,
    cashierName: cashier?.name ?? null,
    costCenterMap,
    expenseCategoryMap,
    storeDevices: [],
    pendingOpeningFloat,
    loadCatalogClient: true,
    enableVariants: businessActivity.enable_variants !== false,
    initialHeldCarts,
  };
}
