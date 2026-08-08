import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_FEATURE_FLAGS,
  FEATURE_FLAGS,
  type FeatureFlag,
} from "@/lib/constants";
import type { Json } from "@/lib/supabase/database.types";
import type { PlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { auditAs } from "@/modules/platform/services/platform-audit.service";

export type PlatformOrgConfig = {
  orgId: string;
  orgName: string;
  currency: string;
  timezone: string;
  country: string;
  taxRate: number;
  taxInclusive: boolean;
  featureFlags: Record<FeatureFlag, boolean>;
  sessionSettings: {
    max_open_hours: number;
    warn_after_hours: number;
    block_sales_when_expired: boolean;
    require_manager_override_for_expired_sale: boolean;
    allow_manager_force_close: boolean;
    manager_discount_override_amount: number | null;
  };
};

function mergeFeatureFlags(stored: Record<string, unknown> | null): Record<FeatureFlag, boolean> {
  const merged: Record<FeatureFlag, boolean> = { ...DEFAULT_FEATURE_FLAGS };
  for (const key of FEATURE_FLAGS) {
    if (typeof stored?.[key] === "boolean") merged[key] = stored[key] as boolean;
  }
  return merged;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function getPlatformOrgConfig(orgId: string): Promise<PlatformOrgConfig> {
  const admin = createAdminClient();
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id, name, currency, timezone, country, settings")
    .eq("id", orgId)
    .maybeSingle();
  if (orgError || !org) throw new Error(orgError?.message ?? "الشركة غير موجودة");

  const { data: settings, error: settingsError } = await admin
    .from("app_settings")
    .select("key, value")
    .eq("org_id", orgId)
    .in("key", ["feature_flags", "session_settings"]);
  if (settingsError) throw new Error(settingsError.message);

  const byKey = new Map((settings ?? []).map((row) => [row.key, asRecord(row.value)]));
  const orgSettings = asRecord(org.settings);
  const session = byKey.get("session_settings") ?? {};

  return {
    orgId: org.id,
    orgName: org.name,
    currency: org.currency,
    timezone: org.timezone,
    country: org.country ?? "",
    taxRate: typeof orgSettings.tax_rate === "number" ? orgSettings.tax_rate : 0,
    taxInclusive:
      typeof orgSettings.tax_inclusive === "boolean" ? orgSettings.tax_inclusive : true,
    featureFlags: mergeFeatureFlags(byKey.get("feature_flags") ?? null),
    sessionSettings: {
      max_open_hours:
        typeof session.max_open_hours === "number" ? session.max_open_hours : 24,
      warn_after_hours:
        typeof session.warn_after_hours === "number" ? session.warn_after_hours : 20,
      block_sales_when_expired:
        typeof session.block_sales_when_expired === "boolean"
          ? session.block_sales_when_expired
          : true,
      require_manager_override_for_expired_sale:
        typeof session.require_manager_override_for_expired_sale === "boolean"
          ? session.require_manager_override_for_expired_sale
          : true,
      allow_manager_force_close:
        typeof session.allow_manager_force_close === "boolean"
          ? session.allow_manager_force_close
          : true,
      manager_discount_override_amount:
        typeof session.manager_discount_override_amount === "number"
          ? session.manager_discount_override_amount
          : null,
    },
  };
}

export async function updatePlatformOrgFeatureFlags(
  platformAdmin: PlatformAdmin,
  orgId: string,
  flags: Partial<Record<FeatureFlag, boolean>>
): Promise<void> {
  const admin = createAdminClient();
  const config = await getPlatformOrgConfig(orgId);
  const next = { ...config.featureFlags, ...flags };

  const { error } = await admin.from("app_settings").upsert(
    {
      org_id: orgId,
      key: "feature_flags",
      value: next as unknown as Json,
    },
    { onConflict: "org_id,key" }
  );
  if (error) throw new Error(error.message);

  await auditAs(platformAdmin, {
    action: "org.feature_flags_update",
    entityType: "organization",
    entityId: orgId,
    metadata: { flags },
  });
}

export async function updatePlatformOrgRemoteSettings(
  platformAdmin: PlatformAdmin,
  orgId: string,
  input: {
    currency?: string;
    timezone?: string;
    country?: string;
    taxRate?: number;
    taxInclusive?: boolean;
    sessionSettings?: Partial<PlatformOrgConfig["sessionSettings"]>;
  }
): Promise<void> {
  const admin = createAdminClient();
  const config = await getPlatformOrgConfig(orgId);

  const needsOrgUpdate =
    Boolean(input.currency?.trim()) ||
    Boolean(input.timezone?.trim()) ||
    input.country !== undefined ||
    input.taxRate !== undefined ||
    input.taxInclusive !== undefined;

  if (needsOrgUpdate) {
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single();
    if (orgError) throw new Error(orgError.message);
    const settings = asRecord(org.settings);
    if (input.taxRate !== undefined) settings.tax_rate = input.taxRate;
    if (input.taxInclusive !== undefined) settings.tax_inclusive = input.taxInclusive;

    const { error: updateError } = await admin
      .from("organizations")
      .update({
        ...(input.currency?.trim() ? { currency: input.currency.trim() } : {}),
        ...(input.timezone?.trim() ? { timezone: input.timezone.trim() } : {}),
        ...(input.country !== undefined ? { country: input.country.trim() } : {}),
        settings: settings as Json,
      })
      .eq("id", orgId);
    if (updateError) throw new Error(updateError.message);
  }

  if (input.sessionSettings) {
    const nextSession = {
      ...config.sessionSettings,
      ...input.sessionSettings,
    };
    const { error } = await admin.from("app_settings").upsert(
      {
        org_id: orgId,
        key: "session_settings",
        value: nextSession as unknown as Json,
      },
      { onConflict: "org_id,key" }
    );
    if (error) throw new Error(error.message);
  }

  await auditAs(platformAdmin, {
    action: "org.settings_update",
    entityType: "organization",
    entityId: orgId,
    metadata: {
      currency: input.currency,
      timezone: input.timezone,
      taxRate: input.taxRate,
      session: input.sessionSettings ?? null,
    },
  });
}
