import * as orgRepo from "@/lib/repositories/organization.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import {
  ACTIVITY_PRESETS,
  DEFAULT_BUSINESS_ACTIVITY_SETTINGS,
  DEFAULT_FEATURE_FLAGS,
  type BusinessActivitySettings,
  type BusinessActivityType,
  type FeatureFlag,
} from "@/lib/constants";
import type { AppSetting, OnlineMenuSettings } from "@/lib/types";

export async function getSettings(): Promise<AppSetting[]> {
  return orgRepo.listSettings();
}

export async function getSetting(key: string): Promise<AppSetting | null> {
  const settings = await orgRepo.listSettings();
  return settings.find((s) => s.key === key) ?? null;
}

export async function upsertSetting(
  key: string,
  value: Record<string, unknown>,
  userId: string
): Promise<AppSetting> {
  const setting = await orgRepo.upsertSetting(key, value);
  const orgId = await orgRepo.getOrgId();
  await writeAuditLog({
    orgId,
    userId,
    action: "settings.updated",
    entityType: "app_setting",
    entityId: setting.id,
    metadata: { key },
  });
  return setting;
}

export async function getFeatureFlags(): Promise<Record<FeatureFlag, boolean>> {
  const setting = await getSetting("feature_flags");
  return {
    ...DEFAULT_FEATURE_FLAGS,
    ...(setting?.value ?? {}),
  } as Record<FeatureFlag, boolean>;
}

export async function isFeatureEnabled(flag: FeatureFlag): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags[flag] !== false;
}

export async function updateFeatureFlags(
  flags: Partial<Record<FeatureFlag, boolean>>,
  userId: string
): Promise<AppSetting> {
  const current = await getFeatureFlags();
  return upsertSetting("feature_flags", { ...current, ...flags }, userId);
}

export async function getBusinessActivitySettings(): Promise<BusinessActivitySettings> {
  const setting = await getSetting("business_activity");
  return {
    ...DEFAULT_BUSINESS_ACTIVITY_SETTINGS,
    ...(setting?.value ?? {}),
  } as BusinessActivitySettings;
}

export async function updateBusinessActivitySettings(
  input: Partial<BusinessActivitySettings>,
  userId: string
) {
  const current = await getBusinessActivitySettings();
  return upsertSetting("business_activity", { ...current, ...input }, userId);
}

export async function applyActivityPreset(activityType: BusinessActivityType, userId: string) {
  const preset = ACTIVITY_PRESETS[activityType];
  const { featureFlags, ...business } = preset;
  await updateBusinessActivitySettings(
    {
      ...business,
      activity_type: activityType,
    },
    userId
  );
  if (featureFlags) {
    await updateFeatureFlags(featureFlags, userId);
  }
}

export async function getOrganizationSettings() {
  const organization = await orgRepo.getOrganization();
  return {
    organization,
    taxRate: (organization.settings.tax_rate as number) ?? 0,
    taxInclusive: (organization.settings.tax_inclusive as boolean) ?? true,
    currency: organization.currency,
    timezone: organization.timezone,
  };
}

export async function updateOrganizationSettings(
  input: {
    name?: string;
    currency?: string;
    timezone?: string;
    country?: string;
    logoUrl?: string | null;
    taxRate?: number;
    taxInclusive?: boolean;
  },
  userId: string
) {
  const org = await orgRepo.getOrganization();
  const settings = { ...org.settings };
  if (input.taxRate !== undefined) settings.tax_rate = input.taxRate;
  if (input.taxInclusive !== undefined) settings.tax_inclusive = input.taxInclusive;

  const updated = await orgRepo.updateOrganization({
    name: input.name ?? org.name,
    currency: input.currency ?? org.currency,
    timezone: input.timezone ?? org.timezone,
    country: input.country ?? org.country,
    logo_url: input.logoUrl === undefined ? org.logo_url : input.logoUrl,
    settings,
  });

  if (input.taxRate !== undefined) {
    await orgRepo.upsertSetting("tax_rate", { rate: input.taxRate });
  }

  await writeAuditLog({
    orgId: updated.id,
    userId,
    action: "organization.updated",
    entityType: "organization",
    entityId: updated.id,
  });

  return updated;
}

const DEFAULT_EXPENSE_SETTINGS = {
  approval_required: false,
  cashier_can_add_session_expense: true,
  cashier_max_expense_amount: null as number | null,
  allow_inventory_purchase_from_session: true,
  default_cost_center_packaging: null as string | null,
  default_cost_center_cleaning: null as string | null,
  default_cost_center_utilities: null as string | null,
  prevent_expenses_in_closed_periods: true,
};

const DEFAULT_SESSION_SETTINGS = {
  max_open_hours: 24,
  warn_after_hours: 20,
  block_sales_when_expired: true,
  require_manager_override_for_expired_sale: true,
  allow_manager_force_close: true,
  manager_discount_override_amount: null as number | null,
};

export const DEFAULT_ONLINE_MENU_SETTINGS: OnlineMenuSettings = {
  logoUrl: "",
  whatsappNumber: "",
  whatsappMessage: "Hello, I would like to ask about the menu.",
  footerText: "Thank you for visiting us.",
  showSearch: true,
  showCategories: true,
  showCart: true,
  showPrices: true,
  showImages: true,
  showPopular: true,
  showVariants: true,
  heroTitle: "",
  heroSubtitle: "",
  primaryColor: "#2563EB",
  accentColor: "#16A34A",
  productCardStyle: "visual",
};

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}

export function normalizeOnlineMenuSettings(
  value?: Partial<OnlineMenuSettings> | Record<string, unknown> | null
): OnlineMenuSettings {
  const input = (value ?? {}) as Record<string, unknown>;
  const merged = {
    ...DEFAULT_ONLINE_MENU_SETTINGS,
    ...input,
  } as OnlineMenuSettings;

  return {
    ...merged,
    logoUrl: typeof input.logoUrl === "string" ? input.logoUrl : DEFAULT_ONLINE_MENU_SETTINGS.logoUrl,
    whatsappNumber:
      typeof input.whatsappNumber === "string"
        ? input.whatsappNumber
        : DEFAULT_ONLINE_MENU_SETTINGS.whatsappNumber,
    whatsappMessage:
      typeof input.whatsappMessage === "string"
        ? input.whatsappMessage
        : DEFAULT_ONLINE_MENU_SETTINGS.whatsappMessage,
    footerText:
      typeof input.footerText === "string" ? input.footerText : DEFAULT_ONLINE_MENU_SETTINGS.footerText,
    heroTitle:
      typeof input.heroTitle === "string" ? input.heroTitle : DEFAULT_ONLINE_MENU_SETTINGS.heroTitle,
    heroSubtitle:
      typeof input.heroSubtitle === "string"
        ? input.heroSubtitle
        : DEFAULT_ONLINE_MENU_SETTINGS.heroSubtitle,
    primaryColor: isHexColor(input.primaryColor)
      ? input.primaryColor
      : DEFAULT_ONLINE_MENU_SETTINGS.primaryColor,
    accentColor: isHexColor(input.accentColor)
      ? input.accentColor
      : DEFAULT_ONLINE_MENU_SETTINGS.accentColor,
    productCardStyle: input.productCardStyle === "compact" ? "compact" : "visual",
    showSearch: input.showSearch !== false,
    showCategories: input.showCategories !== false,
    showCart: input.showCart !== false,
    showPrices: input.showPrices !== false,
    showImages: input.showImages !== false,
    showPopular: input.showPopular !== false,
    showVariants: input.showVariants !== false,
  };
}

export async function getExpenseSettings() {
  const setting = await getSetting("expense_settings");
  return {
    ...DEFAULT_EXPENSE_SETTINGS,
    ...(setting?.value ?? {}),
  };
}

export async function updateExpenseSettings(
  input: Partial<typeof DEFAULT_EXPENSE_SETTINGS>,
  userId: string
) {
  const current = await getExpenseSettings();
  return upsertSetting("expense_settings", { ...current, ...input }, userId);
}

export async function getSessionSettings() {
  const setting = await getSetting("session_settings");
  return {
    ...DEFAULT_SESSION_SETTINGS,
    ...(setting?.value ?? {}),
  };
}

export async function updateSessionSettings(
  input: Partial<typeof DEFAULT_SESSION_SETTINGS>,
  userId: string
) {
  const current = await getSessionSettings();
  const merged = { ...current, ...input };
  if (merged.warn_after_hours > merged.max_open_hours) {
    merged.warn_after_hours = merged.max_open_hours;
  }
  return upsertSetting("session_settings", merged, userId);
}

export async function getOnlineMenuSettings(): Promise<OnlineMenuSettings> {
  const setting = await getSetting("online_menu_settings");
  return normalizeOnlineMenuSettings(setting?.value ?? null);
}

export async function updateOnlineMenuSettings(
  input: Partial<OnlineMenuSettings>,
  userId: string
) {
  const current = await getOnlineMenuSettings();
  return upsertSetting(
    "online_menu_settings",
    normalizeOnlineMenuSettings({ ...current, ...input }) as unknown as Record<string, unknown>,
    userId
  );
}

export async function getSouqnaIntegrationSettings() {
  const { normalizeSouqnaIntegrationSettings } = await import(
    "@/modules/souqna/services/souqna-settings.service"
  );
  const setting = await getSetting("souqna_integration");
  return normalizeSouqnaIntegrationSettings(setting?.value ?? null);
}

export async function updateSouqnaIntegrationSettings(
  input: Partial<import("@/lib/types").SouqnaIntegrationSettings>,
  userId: string
) {
  const { normalizeSouqnaIntegrationSettings } = await import(
    "@/modules/souqna/services/souqna-settings.service"
  );
  const current = await getSouqnaIntegrationSettings();
  const merged = normalizeSouqnaIntegrationSettings({ ...current, ...input });
  return upsertSetting("souqna_integration", merged as unknown as Record<string, unknown>, userId);
}
