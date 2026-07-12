import { z } from "zod";
import {
  ACTIVITY_PRESETS,
  BUSINESS_ACTIVITY_TYPES,
  FEATURE_FLAGS,
  type BusinessActivityType,
} from "@/lib/constants";

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
  organization: z.object({
    name: z.string().min(2, "اسم المؤسسة مطلوب"),
    logoUrl: z.string().optional(),
    currency: z.string().min(1).default("EGP"),
    timezone: z.string().min(1).default("Africa/Cairo"),
    country: z.string().min(1, "الدولة مطلوبة"),
    taxEnabled: z.boolean(),
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

export function mapOnboardingFeaturesToFlags(
  features: Record<OnboardingFeatureKey, boolean>
): Partial<Record<(typeof FEATURE_FLAGS)[number], boolean>> {
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
  };
}

export function mapBusinessTypeToActivity(type: BusinessActivityType) {
  const preset = ACTIVITY_PRESETS[type];
  return {
    activity_type: type,
    enabled_sales_modes: preset.enabled_sales_modes ?? ["retail"],
    default_sales_mode: preset.default_sales_mode ?? "retail",
    enable_weight_sales: preset.enable_weight_sales ?? false,
    enable_piece_sales: preset.enable_piece_sales ?? true,
    enable_wholesale_sales: preset.enable_wholesale_sales ?? false,
    enable_variants: preset.enable_variants ?? true,
    enable_price_by_amount: preset.enable_price_by_amount ?? false,
    allow_cashier_wholesale: preset.allow_cashier_wholesale ?? false,
    require_manager_for_wholesale: preset.require_manager_for_wholesale ?? true,
    auto_apply_wholesale_by_quantity: preset.auto_apply_wholesale_by_quantity ?? false,
  };
}
