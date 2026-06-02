import { z } from "zod";
import {
  BUSINESS_ACTIVITY_TYPES,
  FEATURE_FLAGS,
  type BusinessActivityType,
} from "@/lib/constants";

export const ONBOARDING_FEATURE_KEYS = [
  "recipes",
  "variants",
  "weight_sales",
  "wholesale_sales",
  "purchases",
  "transfers",
  "waste",
  "stock_count",
  "loyalty",
  "customer_accounts",
  "credit_sales",
  "monthly_closing",
  "imports_exports",
  "barcode_scanner",
] as const;

export type OnboardingFeatureKey = (typeof ONBOARDING_FEATURE_KEYS)[number];
const businessTypeSchema = z.enum(BUSINESS_ACTIVITY_TYPES);

export const onboardingPayloadSchema = z.object({
  organization: z.object({
    name: z.string().min(2, "اسم المؤسسة مطلوب"),
    logoUrl: z.string().optional(),
    currency: z.string().min(1).default("USD"),
    timezone: z.string().min(1).default("America/New_York"),
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
    weight_sales: z.boolean(),
    wholesale_sales: z.boolean(),
    purchases: z.boolean(),
    transfers: z.boolean(),
    waste: z.boolean(),
    stock_count: z.boolean(),
    loyalty: z.boolean(),
    customer_accounts: z.boolean(),
    credit_sales: z.boolean(),
    monthly_closing: z.boolean(),
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
    fixed_weight_variants: features.variants,
    weight_sales: features.weight_sales,
    wholesale_sales: features.wholesale_sales,
    purchases: features.purchases,
    transfers: features.transfers,
    waste: features.waste,
    stock_count: features.stock_count,
    loyalty: features.loyalty,
    customer_discounts: features.customer_accounts,
    credit_sales: features.credit_sales,
    monthly_closing: features.monthly_closing,
    imports_exports: features.imports_exports,
    barcode_scanner: features.barcode_scanner,
  };
}

export function mapBusinessTypeToActivity(type: BusinessActivityType) {
  const wholesaleEnabled = type === "wholesale" || type === "supermarket" || type === "mixed";
  const weightEnabled = type === "supermarket" || type === "wholesale" || type === "mixed";
  return {
    activity_type: type,
    enabled_sales_modes: wholesaleEnabled ? ["retail", "wholesale"] : ["retail"],
    default_sales_mode: type === "wholesale" ? "wholesale" : "retail",
    enable_weight_sales: weightEnabled,
    enable_piece_sales: true,
    enable_wholesale_sales: wholesaleEnabled,
    enable_variants: true,
    enable_price_by_amount: type === "supermarket" || type === "mixed",
    allow_cashier_wholesale: wholesaleEnabled,
    require_manager_for_wholesale: !wholesaleEnabled,
    auto_apply_wholesale_by_quantity: wholesaleEnabled,
  };
}
