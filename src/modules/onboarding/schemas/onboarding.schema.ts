import { z } from "zod";
import { FEATURE_FLAGS } from "@/lib/constants";

export const ONBOARDING_FEATURE_KEYS = [
  "recipes",
  "loyalty",
  "credit_sales",
  "waste",
  "transfers",
  "stock_count",
  "barcode_scanner",
  "online_menu",
  "online_orders",
] as const;

export type OnboardingFeatureKey = (typeof ONBOARDING_FEATURE_KEYS)[number];

export const onboardingPayloadSchema = z.object({
  organization: z.object({
    name: z.string().min(2, "Organization name is required"),
    logoUrl: z.string().optional(),
    currency: z.string().min(1).default("USD"),
    timezone: z.string().min(1).default("America/New_York"),
    country: z.string().min(1, "Country is required"),
  }),
  store: z.object({
    name: z.string().min(2, "Store name is required"),
    address: z.string().min(1, "Address is required"),
    phone: z.string().optional(),
  }),
  owner: z.object({
    name: z.string().min(2, "Owner name is required"),
    email: z.string().email("Valid email is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
  }),
  business: z.object({
    taxEnabled: z.boolean(),
    taxRate: z.number().min(0).max(100),
    receiptHeader: z.string().optional(),
    receiptFooter: z.string().optional(),
  }),
  features: z.object({
    recipes: z.boolean(),
    loyalty: z.boolean(),
    credit_sales: z.boolean(),
    waste: z.boolean(),
    transfers: z.boolean(),
    stock_count: z.boolean(),
    barcode_scanner: z.boolean(),
    online_menu: z.boolean(),
    online_orders: z.boolean(),
  }),
});

export type OnboardingPayload = z.infer<typeof onboardingPayloadSchema>;

export function mapOnboardingFeaturesToFlags(
  features: Record<OnboardingFeatureKey, boolean>
): Partial<Record<(typeof FEATURE_FLAGS)[number], boolean>> {
  return {
    recipes: features.recipes,
    loyalty: features.loyalty,
    credit_sales: features.credit_sales,
    waste: features.waste,
    transfers: features.transfers,
    stock_count: features.stock_count,
    barcode_scanner: features.barcode_scanner,
    online_menu: features.online_menu,
    online_orders: features.online_orders,
  };
}
