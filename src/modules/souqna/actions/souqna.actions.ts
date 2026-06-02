"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { requirePermissionOrRole } from "@/lib/auth/guards";
import { generateSouqnaApiKey } from "@/lib/api/souqna-auth";
import {
  getSouqnaIntegrationStats,
  listSouqnaIntegrationLogs,
} from "@/lib/repositories/souqna.repository";
import {
  getSouqnaIntegrationSettings,
  updateSouqnaIntegrationSettings,
} from "@/modules/system/services/settings.service";
import {
  publicSouqnaSettings,
  validateSouqnaApiBaseUrl,
  validateSouqnaWebhookUrl,
} from "@/modules/souqna/services/souqna-settings.service";
import { resolveSouqnaApiBaseUrlFromRequest } from "@/lib/souqna-api-url";
import type { SouqnaIntegrationSettings } from "@/lib/types";
import { getOrgId } from "@/lib/repositories/organization.repository";

export async function getSouqnaSettingsAction() {
  await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  const settings = await getSouqnaIntegrationSettings();
  const suggestedBaseUrl = await resolveSouqnaApiBaseUrlFromRequest();
  return publicSouqnaSettings(settings, { suggestedBaseUrl });
}

export async function getSouqnaSettingsBundleAction() {
  await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  const orgId = await getOrgId();
  const settings = await getSouqnaIntegrationSettings();
  const suggestedBaseUrl = await resolveSouqnaApiBaseUrlFromRequest();
  const [publicSettings, stats, logs] = await Promise.all([
    Promise.resolve(publicSouqnaSettings(settings, { suggestedBaseUrl })),
    getSouqnaIntegrationStats(orgId),
    listSouqnaIntegrationLogs({ orgId, limit: 25, offset: 0 }),
  ]);
  return {
    settings: publicSettings,
    stats,
    logs,
    logsPage: 1,
    logsHasMore: logs.length === 25,
  };
}

export async function updateSouqnaSettingsAction(
  input: Omit<
    Partial<SouqnaIntegrationSettings>,
    "api_key_hash" | "api_key_prefix"
  > & { souqna_webhook_secret?: string }
) {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  if (input.api_base_url !== undefined) {
    const urlError = validateSouqnaApiBaseUrl(input.api_base_url);
    if (urlError) throw new Error(urlError);
  }
  if (input.souqna_webhook_url !== undefined) {
    const webhookError = validateSouqnaWebhookUrl(input.souqna_webhook_url);
    if (webhookError) throw new Error(webhookError);
  }

  const patch = { ...input };
  if (!patch.souqna_webhook_secret?.trim()) {
    delete patch.souqna_webhook_secret;
  }

  await updateSouqnaIntegrationSettings(patch, user.id);
  revalidatePath("/settings");
  return getSouqnaSettingsAction();
}

export async function regenerateSouqnaApiKeyAction() {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  const { apiKey, apiKeyHash, apiKeyPrefix } = generateSouqnaApiKey();
  await updateSouqnaIntegrationSettings(
    {
      api_key_hash: apiKeyHash,
      api_key_prefix: apiKeyPrefix,
    },
    user.id
  );
  revalidatePath("/settings");
  return { apiKey, apiKeyPrefix };
}

export async function testSouqnaApiKeyAction(apiKey: string) {
  await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  const settings = await getSouqnaIntegrationSettings();
  if (!settings.enable_souqna_channel) {
    throw new Error("Souqna channel is disabled");
  }
  if (!settings.api_key_hash) {
    throw new Error("No API key configured");
  }
  if (!settings.allowed_store_id) {
    throw new Error("Allowed store is not configured");
  }
  const valid = await bcrypt.compare(apiKey.trim(), settings.api_key_hash);
  if (!valid) {
    throw new Error("Invalid API key");
  }
  return { ok: true, message: "API key is valid" };
}

export async function listSouqnaLogsAction(page = 1) {
  await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  const orgId = await getOrgId();
  const pageSize = 25;
  const offset = (Math.max(1, page) - 1) * pageSize;
  const logs = await listSouqnaIntegrationLogs({ orgId, limit: pageSize, offset });
  return {
    logs,
    page: Math.max(1, page),
    hasMore: logs.length === pageSize,
  };
}

export async function publishAllProductsToSouqnaAction() {
  const user = await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  const orgId = await getOrgId();
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error } = await admin
    .from("products")
    .update({ publish_to_souqna: true })
    .eq("org_id", orgId)
    .eq("product_type", "finished");
  if (error) throw new Error(error.message);
  const { writeAuditLog } = await import("@/lib/services/audit.service");
  await writeAuditLog({
    orgId,
    userId: user.id,
    action: "souqna.publish_all_products",
    entityType: "organization",
    entityId: orgId,
  });
  revalidatePath("/products");
  revalidatePath("/settings");
}

export async function unpublishAllProductsFromSouqnaAction() {
  const user = await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  const orgId = await getOrgId();
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error } = await admin
    .from("products")
    .update({ publish_to_souqna: false })
    .eq("org_id", orgId)
    .eq("product_type", "finished");
  if (error) throw new Error(error.message);
  const { writeAuditLog } = await import("@/lib/services/audit.service");
  await writeAuditLog({
    orgId,
    userId: user.id,
    action: "souqna.unpublish_all_products",
    entityType: "organization",
    entityId: orgId,
  });
  revalidatePath("/products");
  revalidatePath("/settings");
}
