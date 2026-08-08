import { createHmac, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import type { PlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { auditAs } from "@/modules/platform/services/platform-audit.service";

export const PLATFORM_WEBHOOKS_KEY = "platform_webhooks";

export const PLATFORM_WEBHOOK_EVENTS = [
  "org.suspended",
  "org.reactivated",
  "user.deactivated",
  "user.activated",
  "session.force_closed",
  "device.deactivated",
  "device.activated",
] as const;

export type PlatformWebhookEvent = (typeof PLATFORM_WEBHOOK_EVENTS)[number];

export type PlatformWebhookConfig = {
  enabled: boolean;
  url: string;
  secret: string;
  events: PlatformWebhookEvent[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeWebhookConfig(value: unknown): PlatformWebhookConfig {
  const raw = asRecord(value);
  const events = Array.isArray(raw.events)
    ? raw.events.filter((e): e is PlatformWebhookEvent =>
        (PLATFORM_WEBHOOK_EVENTS as readonly string[]).includes(String(e))
      )
    : [...PLATFORM_WEBHOOK_EVENTS];

  return {
    enabled: Boolean(raw.enabled),
    url: typeof raw.url === "string" ? raw.url.trim() : "",
    secret: typeof raw.secret === "string" ? raw.secret : "",
    events,
  };
}

export async function getPlatformWebhookConfig(
  orgId: string
): Promise<PlatformWebhookConfig> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_settings")
    .select("value")
    .eq("org_id", orgId)
    .eq("key", PLATFORM_WEBHOOKS_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeWebhookConfig(data?.value ?? null);
}

export async function setPlatformWebhookConfig(
  platformAdmin: PlatformAdmin,
  orgId: string,
  input: Partial<PlatformWebhookConfig> & { rotateSecret?: boolean }
): Promise<PlatformWebhookConfig> {
  const current = await getPlatformWebhookConfig(orgId);
  let secret = input.secret ?? current.secret;
  if (input.rotateSecret || !secret) {
    secret = randomBytes(24).toString("base64url");
  }

  const next = normalizeWebhookConfig({
    enabled: input.enabled ?? current.enabled,
    url: input.url ?? current.url,
    secret,
    events: input.events ?? current.events,
  });

  if (next.enabled) {
    if (!next.url.startsWith("https://")) {
      throw new Error("رابط الـ webhook لازم يبدأ بـ https://");
    }
  }

  const admin = createAdminClient();
  const { error } = await admin.from("app_settings").upsert(
    {
      org_id: orgId,
      key: PLATFORM_WEBHOOKS_KEY,
      value: next as unknown as Json,
    },
    { onConflict: "org_id,key" }
  );
  if (error) throw new Error(error.message);

  await auditAs(platformAdmin, {
    action: "org.webhook_update",
    entityType: "organization",
    entityId: orgId,
    metadata: {
      enabled: next.enabled,
      url: next.url,
      events: next.events,
      secret_rotated: Boolean(input.rotateSecret),
    },
  });

  return next;
}

export async function dispatchPlatformWebhook(
  orgId: string,
  event: PlatformWebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const config = await getPlatformWebhookConfig(orgId);
    if (!config.enabled || !config.url || !config.events.includes(event)) return;

    const body = JSON.stringify({
      event,
      org_id: orgId,
      sent_at: new Date().toISOString(),
      data: payload,
    });
    const signature = createHmac("sha256", config.secret).update(body).digest("hex");

    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-velora-event": event,
        "x-velora-signature": signature,
        "user-agent": "Velora-Platform-Webhook/1.0",
      },
      body,
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error("[webhook] delivery failed", {
        orgId,
        event,
        status: response.status,
      });
    }
  } catch (error) {
    console.error("[webhook] dispatch error", error);
  }
}
