import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { SouqnaApiError } from "@/lib/api/souqna-response";
import { assertSouqnaRateLimit } from "@/lib/api/souqna-rate-limit";
import {
  normalizeSouqnaIntegrationSettings,
  type StoredSouqnaIntegrationSettings,
} from "@/modules/souqna/services/souqna-settings.service";
import type { SouqnaIntegrationSettings } from "@/lib/types";

export interface SouqnaAuthContext {
  orgId: string;
  storeId: string;
  settings: SouqnaIntegrationSettings;
}

function settingsFromRow(value: unknown): StoredSouqnaIntegrationSettings {
  return normalizeSouqnaIntegrationSettings(
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  );
}

export async function authenticateSouqnaRequest(
  request: Request,
  options?: { requireOrderImport?: boolean }
): Promise<SouqnaAuthContext> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new SouqnaApiError(401, "Missing or invalid Authorization header");
  }

  const apiKey = authHeader.slice(7).trim();
  if (!apiKey) {
    throw new SouqnaApiError(401, "Missing API key");
  }

  const rateLimitPrefix = createHash("sha256").update(apiKey).digest("hex").slice(0, 8);
  await assertSouqnaRateLimit(rateLimitPrefix);

  const keyPrefix = apiKey.slice(0, 12);
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("app_settings")
    .select("org_id, value")
    .eq("key", "souqna_integration");

  if (error) {
    throw new SouqnaApiError(500, "Could not validate API key");
  }

  for (const row of rows ?? []) {
    const settings = settingsFromRow(row.value);
    if (!settings.enable_souqna_channel || !settings.api_key_hash) continue;
    if (settings.api_key_prefix && settings.api_key_prefix !== keyPrefix) continue;

    const valid = await bcrypt.compare(apiKey, settings.api_key_hash);
    if (!valid) continue;

    if (!settings.allowed_store_id) {
      throw new SouqnaApiError(403, "Souqna integration store is not configured");
    }

    const { data: store, error: storeError } = await admin
      .from("stores")
      .select("id, org_id")
      .eq("id", settings.allowed_store_id)
      .maybeSingle();

    if (storeError || !store || store.org_id !== row.org_id) {
      throw new SouqnaApiError(403, "Configured store is invalid");
    }

    if (options?.requireOrderImport && !settings.allow_order_import) {
      throw new SouqnaApiError(403, "Order import is disabled");
    }

    const { data: flagSetting } = await admin
      .from("app_settings")
      .select("value")
      .eq("org_id", row.org_id)
      .eq("key", "feature_flags")
      .maybeSingle();
    const flags = (flagSetting?.value ?? {}) as Record<string, unknown>;
    if (flags.souqna_integration === false) {
      throw new SouqnaApiError(403, "Souqna integration is disabled");
    }

    return {
      orgId: row.org_id,
      storeId: settings.allowed_store_id,
      settings: {
        enable_souqna_channel: settings.enable_souqna_channel,
        api_base_url: settings.api_base_url,
        api_key_hash: settings.api_key_hash,
        api_key_prefix: settings.api_key_prefix,
        allowed_store_id: settings.allowed_store_id,
        allow_order_import: settings.allow_order_import,
        reserve_stock_on_online_order: settings.reserve_stock_on_online_order,
        publish_products_to_souqna: settings.publish_products_to_souqna,
        enable_souqna_webhook: settings.enable_souqna_webhook,
        souqna_webhook_url: settings.souqna_webhook_url,
        souqna_webhook_secret: settings.souqna_webhook_secret,
      },
    };
  }

  throw new SouqnaApiError(401, "Invalid API key");
}

export function generateSouqnaApiKey(): {
  apiKey: string;
  apiKeyHash: string;
  apiKeyPrefix: string;
} {
  const apiKey = `sq_live_${randomBytes(24).toString("hex")}`;
  const apiKeyHash = bcrypt.hashSync(apiKey, 10);
  const apiKeyPrefix = apiKey.slice(0, 12);
  return { apiKey, apiKeyHash, apiKeyPrefix };
}
