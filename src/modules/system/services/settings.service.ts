import * as orgRepo from "@/lib/repositories/organization.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import {
  ACTIVITY_PRESETS,
  DEFAULT_BUSINESS_ACTIVITY_SETTINGS,
  DEFAULT_PRODUCT_TEMPLATES_BY_ACTIVITY,
  PRODUCT_TEMPLATE_IDS,
  SALES_MODES,
  DEFAULT_FEATURE_FLAGS,
  type BusinessActivitySettings,
  type BusinessActivityType,
  type FeatureFlag,
  type ProductTemplate,
  type ProductTemplateSettings,
} from "@/lib/constants";
import type { AppSetting } from "@/lib/types";
const BUSINESS_ACTIVITY_MANAGED_FLAGS: FeatureFlag[] = ["barcode_scanner", "recipes"];

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
  return normalizeBusinessActivitySettings(setting?.value ?? null);
}

function normalizeProductTemplate(
  template: unknown,
  fallback: ProductTemplate
): ProductTemplate {
  const input = (template ?? {}) as Partial<ProductTemplate>;
  return {
    ...fallback,
    ...input,
    id: fallback.id,
    label: typeof input.label === "string" ? input.label : fallback.label,
  };
}

export function normalizeProductTemplateSettings(
  value: Record<string, unknown> | Partial<ProductTemplateSettings> | null | undefined,
  activityType: BusinessActivityType
): ProductTemplateSettings {
  const defaults = DEFAULT_PRODUCT_TEMPLATES_BY_ACTIVITY[activityType];
  const input = (value ?? {}) as Record<string, unknown>;

  return PRODUCT_TEMPLATE_IDS.reduce((acc, templateId) => {
    acc[templateId] = normalizeProductTemplate(input[templateId], defaults[templateId]);
    return acc;
  }, {} as ProductTemplateSettings);
}

export async function getProductTemplateSettings(
  activityType?: BusinessActivityType
): Promise<ProductTemplateSettings> {
  const resolvedActivityType = activityType ?? (await getBusinessActivitySettings()).activity_type;
  const setting = await getSetting("product_templates");
  return normalizeProductTemplateSettings(setting?.value ?? null, resolvedActivityType);
}

export async function updateProductTemplateSettings(
  input: Partial<ProductTemplateSettings>,
  userId: string
) {
  const business = await getBusinessActivitySettings();
  const current = await getProductTemplateSettings(business.activity_type);
  const merged = normalizeProductTemplateSettings(
    {
      ...current,
      ...input,
    } as Record<string, unknown>,
    business.activity_type
  );
  return upsertSetting("product_templates", merged as unknown as Record<string, unknown>, userId);
}

export async function updateBusinessActivitySettings(
  input: Partial<BusinessActivitySettings>,
  userId: string
) {
  const current = await getBusinessActivitySettings();
  const merged = normalizeBusinessActivitySettings({ ...current, ...input });
  const setting = await upsertSetting(
    "business_activity",
    merged as unknown as Record<string, unknown>,
    userId
  );
  await updateFeatureFlags(buildBusinessActivityFeatureFlags(merged), userId);
  return setting;
}

function normalizeBusinessActivitySettings(
  value?: Partial<BusinessActivitySettings> | Record<string, unknown> | null
): BusinessActivitySettings {
  const isSalesMode = (
    mode: unknown
  ): mode is BusinessActivitySettings["default_sales_mode"] =>
    typeof mode === "string" && (SALES_MODES as readonly string[]).includes(mode);

  const input = (value ?? {}) as Record<string, unknown>;
  const merged = {
    ...DEFAULT_BUSINESS_ACTIVITY_SETTINGS,
    ...input,
  } as BusinessActivitySettings;

  const enabled_sales_modes = Array.isArray(input.enabled_sales_modes)
    ? input.enabled_sales_modes.filter(
        (mode): mode is BusinessActivitySettings["default_sales_mode"] => isSalesMode(mode)
      )
    : merged.enabled_sales_modes;

  const safeModes =
    enabled_sales_modes.length > 0
      ? enabled_sales_modes
      : DEFAULT_BUSINESS_ACTIVITY_SETTINGS.enabled_sales_modes;

  const safeDefault =
    isSalesMode(input.default_sales_mode) && safeModes.includes(input.default_sales_mode)
      ? input.default_sales_mode
      : safeModes[0] ?? DEFAULT_BUSINESS_ACTIVITY_SETTINGS.default_sales_mode;

  return {
    ...merged,
    enabled_sales_modes: safeModes,
    default_sales_mode: safeDefault,
  };
}

export async function applyActivityPreset(activityType: BusinessActivityType, userId: string) {
  const preset = ACTIVITY_PRESETS[activityType];
  const { featureFlags, ...business } = preset;
  void featureFlags;
  await updateBusinessActivitySettings(
    {
      ...business,
      activity_type: activityType,
    },
    userId
  );
}

function buildBusinessActivityFeatureFlags(
  settings: BusinessActivitySettings
): Partial<Record<FeatureFlag, boolean>> {
  const base = Object.fromEntries(
    BUSINESS_ACTIVITY_MANAGED_FLAGS.map((flag) => [flag, false])
  ) as Partial<Record<FeatureFlag, boolean>>;

  const preset = ACTIVITY_PRESETS[settings.activity_type];
  const presetFlags = preset?.featureFlags ?? {};

  const derived: Partial<Record<FeatureFlag, boolean>> = {
    ...base,
    ...presetFlags,
    barcode_scanner: true,
    recipes: presetFlags.recipes ?? settings.activity_type !== "cafe",
  };

  return derived;
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
    phone?: string;
    address?: string;
  },
  userId: string
) {
  const org = await orgRepo.getOrganization();
  const settings = { ...org.settings };
  if (input.taxRate !== undefined) settings.tax_rate = input.taxRate;
  if (input.taxInclusive !== undefined) settings.tax_inclusive = input.taxInclusive;
  if (input.phone !== undefined) settings.phone = input.phone;
  if (input.address !== undefined) settings.address = input.address;

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

const DEFAULT_INVENTORY_POLICY_SETTINGS = {
  expiry_alerts_enabled: true,
  alert_days: [7, 14, 30],
  default_tracking_mode: "standard",
  default_rotation_method: "FIFO",
  default_expiry_policy: "block_sale",
  block_sale_of_expired_items: true,
  allow_manager_override: true,
};

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

export async function getInventoryPolicySettings() {
  const setting = await getSetting("inventory_policy");
  return {
    ...DEFAULT_INVENTORY_POLICY_SETTINGS,
    ...(setting?.value ?? {}),
  };
}

export async function updateInventoryPolicySettings(
  input: Partial<typeof DEFAULT_INVENTORY_POLICY_SETTINGS>,
  userId: string
) {
  const current = await getInventoryPolicySettings();
  return upsertSetting("inventory_policy", { ...current, ...input }, userId);
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
