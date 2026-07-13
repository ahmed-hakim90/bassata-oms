import { z } from "zod";
import {
  ACTIVITY_PRESETS,
  BUSINESS_ACTIVITY_TYPES,
  type BusinessActivitySettings,
  type BusinessActivityType,
  type FeatureFlag,
} from "@/lib/constants";
import { buildBusinessActivityFeatureFlags } from "@/lib/business-activity-flags";

export const ONBOARDING_FEATURE_KEYS = [
  "recipes",
  "variants",
  "purchases",
  "transfers",
  "waste",
  "stock_count",
  "loyalty",
  "customer_accounts",
  "credit_sales",
  "imports_exports",
  "barcode_scanner",
] as const;

export type OnboardingFeatureKey = (typeof ONBOARDING_FEATURE_KEYS)[number];
const businessTypeSchema = z.enum(BUSINESS_ACTIVITY_TYPES);

export const onboardingPayloadSchema = z.object({
  /** Plaintext invite from platform; required in production (enforced in bootstrap). */
  inviteToken: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  organization: z.object({
    name: z.string().min(2, "اسم المؤسسة مطلوب"),
    logoUrl: z.string().optional(),
    currency: z.string().min(1).default("EGP"),
    timezone: z.string().min(1).default("Africa/Cairo"),
    country: z.string().min(1, "الدولة مطلوبة"),
    taxEnabled: z.boolean(),
    /** Percentage 0–100 in the wizard; bootstrap converts to fraction for settings. */
    taxRate: z.number().min(0).max(100),
    taxInclusive: z.boolean(),
  }),
  store: z.object({
    name: z.string().min(2, "اسم الفرع مطلوب"),
    address: z.string().min(1, "العنوان مطلوب"),
    phone: z.string().optional(),
    timezone: z.string().min(1).default("America/New_York"),
  }),
  owner: z.object({
    name: z.string().min(2, "اسم المالك مطلوب"),
    email: z.string().email("البريد الإلكتروني غير صالح"),
    password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
  }),
  businessType: businessTypeSchema,
  defaultSettings: z.object({
    paymentMethods: z.object({
      cash: z.boolean(),
      card: z.boolean(),
      wallet: z.boolean(),
      /** Kept for schema compat; bootstrap uses features.credit_sales as source of truth. */
      credit: z.boolean(),
      manualWallet: z.boolean(),
    }),
    receiptHeader: z.string().optional(),
    receiptFooter: z.string().optional(),
    preventNegativeStock: z.boolean(),
    defaultTaxBehavior: z.enum(["inclusive", "exclusive"]),
    sessionRules: z.object({
      maxOpenHours: z.number().min(1).max(72),
      warnAfterHours: z.number().min(1).max(72),
      blockSalesWhenExpired: z.boolean(),
      requireManagerOverrideForExpiredSale: z.boolean(),
      allowManagerForceClose: z.boolean(),
    }),
    expenseRules: z.object({
      approvalRequired: z.boolean(),
      cashierCanAddSessionExpense: z.boolean(),
      allowInventoryPurchaseFromSession: z.boolean(),
      preventExpensesInClosedPeriods: z.boolean(),
    }),
  }),
  features: z.object({
    recipes: z.boolean(),
    variants: z.boolean(),
    purchases: z.boolean(),
    transfers: z.boolean(),
    waste: z.boolean(),
    stock_count: z.boolean(),
    loyalty: z.boolean(),
    customer_accounts: z.boolean(),
    credit_sales: z.boolean(),
    imports_exports: z.boolean(),
    barcode_scanner: z.boolean(),
  }),
  initialSetup: z.object({
    createDefaultCostCenters: z.boolean(),
    createDefaultExpenseCategories: z.boolean(),
    createDefaultProductCategories: z.boolean(),
    createDefaultInventoryUnits: z.boolean(),
    createFirstPosDevice: z.boolean(),
    firstPosDeviceName: z.string().optional(),
  }),
});

export type OnboardingPayload = z.infer<typeof onboardingPayloadSchema>;

/** Feature toggles shown in Settings → System Features / POS (same keys). */
export function mapOnboardingFeaturesToFlags(
  features: Record<OnboardingFeatureKey, boolean>,
  options?: { taxEnabled?: boolean; preventNegativeStock?: boolean }
): Partial<Record<FeatureFlag, boolean>> {
  return {
    recipes: features.recipes,
    purchases: features.purchases,
    transfers: features.transfers,
    waste: features.waste,
    stock_count: features.stock_count,
    loyalty: features.loyalty,
    customer_discounts: features.customer_accounts,
    credit_sales: features.credit_sales,
    imports_exports: features.imports_exports,
    barcode_scanner: features.barcode_scanner,
    ...(typeof options?.taxEnabled === "boolean" ? { tax: options.taxEnabled } : {}),
    ...(typeof options?.preventNegativeStock === "boolean"
      ? { prevent_negative_stock: options.preventNegativeStock }
      : {}),
  };
}

/** Prefill onboarding feature checkboxes from activity preset. */
export function defaultOnboardingFeaturesForActivity(
  type: BusinessActivityType
): Record<OnboardingFeatureKey, boolean> {
  const preset = ACTIVITY_PRESETS[type];
  const managed = buildBusinessActivityFeatureFlags({ activity_type: type });
  const base = {
    ...Object.fromEntries(
      ONBOARDING_FEATURE_KEYS.map((key) => [key, key !== "credit_sales"])
    ),
  } as Record<OnboardingFeatureKey, boolean>;

  return {
    ...base,
    variants: preset.enable_variants ?? true,
    recipes: managed.recipes ?? base.recipes,
    barcode_scanner: managed.barcode_scanner ?? base.barcode_scanner,
    credit_sales: managed.credit_sales ?? base.credit_sales,
  };
}

export function mapBusinessTypeToActivity(
  type: BusinessActivityType,
  options?: { enableVariants?: boolean }
): BusinessActivitySettings {
  const preset = ACTIVITY_PRESETS[type];
  // Activity presets that disable variants (e.g. supermarket) cannot be overridden
  // by onboarding feature checkboxes.
  const enableVariants =
    preset.enable_variants === false
      ? false
      : (options?.enableVariants ?? preset.enable_variants ?? true);
  return {
    activity_type: type,
    enabled_sales_modes: preset.enabled_sales_modes ?? ["retail"],
    default_sales_mode: preset.default_sales_mode ?? "retail",
    enable_weight_sales: preset.enable_weight_sales ?? false,
    enable_piece_sales: preset.enable_piece_sales ?? true,
    enable_wholesale_sales: preset.enable_wholesale_sales ?? false,
    enable_variants: enableVariants,
    enable_price_by_amount: preset.enable_price_by_amount ?? false,
    allow_cashier_wholesale: preset.allow_cashier_wholesale ?? false,
    require_manager_for_wholesale: preset.require_manager_for_wholesale ?? true,
    auto_apply_wholesale_by_quantity: preset.auto_apply_wholesale_by_quantity ?? false,
    default_inventory_tracking_mode:
      preset.default_inventory_tracking_mode ?? "standard",
    default_inventory_rotation_method:
      preset.default_inventory_rotation_method ?? "FIFO",
    default_expiry_policy: preset.default_expiry_policy ?? "warn_only",
    enable_batch_tracking: preset.enable_batch_tracking ?? true,
    enable_expiry_tracking: preset.enable_expiry_tracking ?? true,
    enable_serial_tracking: preset.enable_serial_tracking ?? false,
    expiry_alert_days: preset.expiry_alert_days ?? [7, 14, 30],
  };
}

/**
 * Build feature_flags payload matching Settings reads:
 * module toggles + tax/prevent_negative_stock + activity-managed barcode.
 */
export function buildOnboardingFeatureFlags(
  payload: Pick<
    OnboardingPayload,
    "features" | "organization" | "defaultSettings" | "businessType"
  >
): Partial<Record<FeatureFlag, boolean>> {
  const fromFeatures = mapOnboardingFeaturesToFlags(payload.features, {
    taxEnabled: payload.organization.taxEnabled,
    preventNegativeStock: payload.defaultSettings.preventNegativeStock,
  });
  const managed = buildBusinessActivityFeatureFlags({
    activity_type: payload.businessType,
  });
  return {
    ...fromFeatures,
    // Activity-managed flags always win (supermarket recipes stay off).
    barcode_scanner: managed.barcode_scanner ?? fromFeatures.barcode_scanner,
    recipes: managed.recipes ?? fromFeatures.recipes,
  };
}
