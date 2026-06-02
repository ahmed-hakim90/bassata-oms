import type { SouqnaIntegrationSettings, SouqnaPublicApiConfig } from "@/lib/types";
import {
  buildSouqnaApiEndpoints,
  isValidApiBaseUrl,
  normalizeApiBaseUrl,
  resolveDefaultSouqnaApiBaseUrl,
} from "@/lib/souqna-api-url";

export const DEFAULT_SOUQNA_INTEGRATION_SETTINGS: SouqnaIntegrationSettings = {
  enable_souqna_channel: false,
  api_base_url: "",
  api_key_hash: "",
  api_key_prefix: "",
  allowed_store_id: null,
  allow_order_import: true,
  reserve_stock_on_online_order: false,
  publish_products_to_souqna: false,
  enable_souqna_webhook: false,
  souqna_webhook_url: "",
  souqna_webhook_secret: "",
};

export type StoredSouqnaIntegrationSettings = SouqnaIntegrationSettings;

export function normalizeSouqnaIntegrationSettings(
  value?: Partial<SouqnaIntegrationSettings> | Record<string, unknown> | null
): StoredSouqnaIntegrationSettings {
  const input = (value ?? {}) as Record<string, unknown>;
  return {
    enable_souqna_channel: input.enable_souqna_channel === true,
    api_base_url:
      typeof input.api_base_url === "string" ? normalizeApiBaseUrl(input.api_base_url) : "",
    api_key_hash: typeof input.api_key_hash === "string" ? input.api_key_hash : "",
    api_key_prefix: typeof input.api_key_prefix === "string" ? input.api_key_prefix : "",
    allowed_store_id:
      typeof input.allowed_store_id === "string" ? input.allowed_store_id : null,
    allow_order_import: input.allow_order_import !== false,
    reserve_stock_on_online_order: input.reserve_stock_on_online_order === true,
    publish_products_to_souqna: input.publish_products_to_souqna === true,
    enable_souqna_webhook: input.enable_souqna_webhook === true,
    souqna_webhook_url:
      typeof input.souqna_webhook_url === "string"
        ? normalizeApiBaseUrl(input.souqna_webhook_url)
        : "",
    souqna_webhook_secret:
      typeof input.souqna_webhook_secret === "string" ? input.souqna_webhook_secret : "",
  };
}

export function publicSouqnaSettings(
  settings: StoredSouqnaIntegrationSettings,
  options?: { suggestedBaseUrl?: string }
): Omit<SouqnaIntegrationSettings, "api_key_hash" | "souqna_webhook_secret"> & {
  has_api_key: boolean;
  has_webhook_secret: boolean;
  api: SouqnaPublicApiConfig;
} {
  const effectiveBase =
    settings.api_base_url ||
    options?.suggestedBaseUrl ||
    resolveDefaultSouqnaApiBaseUrl();
  const endpoints = buildSouqnaApiEndpoints(effectiveBase);

  return {
    enable_souqna_channel: settings.enable_souqna_channel,
    api_base_url: settings.api_base_url,
    api_key_prefix: settings.api_key_prefix,
    allowed_store_id: settings.allowed_store_id,
    allow_order_import: settings.allow_order_import,
    reserve_stock_on_online_order: settings.reserve_stock_on_online_order,
    publish_products_to_souqna: settings.publish_products_to_souqna,
    enable_souqna_webhook: settings.enable_souqna_webhook,
    souqna_webhook_url: settings.souqna_webhook_url,
    has_api_key: Boolean(settings.api_key_hash),
    has_webhook_secret: Boolean(settings.souqna_webhook_secret),
    api: {
      ...endpoints,
      auth_header: "Authorization: Bearer {api_key}",
    },
  };
}

export function validateSouqnaApiBaseUrl(url: string): string | null {
  if (!url.trim()) return null;
  if (!isValidApiBaseUrl(url)) {
    return "Enter a valid URL starting with http:// or https://";
  }
  return null;
}

export function validateSouqnaWebhookUrl(url: string): string | null {
  if (!url.trim()) return null;
  if (!isValidApiBaseUrl(url)) {
    return "Enter a valid Souqna webhook base URL";
  }
  return null;
}
