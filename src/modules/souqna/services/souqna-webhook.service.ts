import { createHmac } from "crypto";
import { writeSouqnaIntegrationLog } from "@/lib/repositories/souqna.repository";
import { getSouqnaIntegrationSettings } from "@/modules/system/services/settings.service";
import type { OnlineOrder, OnlineOrderStatus } from "@/lib/types";

export type SouqnaWebhookStatus =
  | "received"
  | "accepted"
  | "preparing"
  | "ready"
  | "rejected"
  | "cancelled"
  | "completed";

function mapOnlineStatusToSouqna(status: OnlineOrderStatus): SouqnaWebhookStatus {
  switch (status) {
    case "pending":
      return "received";
    case "accepted":
      return "accepted";
    case "preparing":
      return "preparing";
    case "ready":
      return "ready";
    case "cancelled":
      return "cancelled";
    case "invoiced":
      return "completed";
    default:
      return "received";
  }
}

function webhookMessage(status: SouqnaWebhookStatus): string {
  switch (status) {
    case "accepted":
      return "Order accepted";
    case "preparing":
      return "Order is preparing";
    case "ready":
      return "Order is ready";
    case "cancelled":
      return "Order cancelled";
    case "completed":
      return "Order completed";
    case "rejected":
      return "Order rejected";
    default:
      return "Order received";
  }
}

function buildWebhookUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  return `${normalized}/api/integrations/store-system/order-status`;
}

function signPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export async function notifySouqnaOrderStatusChange(input: {
  order: OnlineOrder;
  orgId: string;
  status?: OnlineOrderStatus;
}): Promise<void> {
  if (input.order.source !== "souqna" || !input.order.external_order_id) return;

  const settings = await getSouqnaIntegrationSettings();
  if (!settings.enable_souqna_webhook || !settings.souqna_webhook_url?.trim()) return;

  const souqnaStatus = mapOnlineStatusToSouqna(input.status ?? input.order.status);
  const payload = {
    souqna_order_id: input.order.external_order_id,
    external_order_id: input.order.id,
    status: souqnaStatus,
    message: webhookMessage(souqnaStatus),
    updated_at: new Date().toISOString(),
  };

  const endpoint = buildWebhookUrl(settings.souqna_webhook_url);
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (settings.souqna_webhook_secret) {
    headers["X-Souqna-Signature"] = signPayload(settings.souqna_webhook_secret, body);
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body,
    });
    const responseText = await response.text();
    let responsePayload: Record<string, unknown> = { status: response.status, body: responseText };
    try {
      responsePayload = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      // keep text body
    }

    await writeSouqnaIntegrationLog({
      orgId: input.orgId,
      storeId: input.order.store_id,
      direction: "outbound",
      endpoint,
      requestType: "orders.status_callback",
      requestPayload: payload,
      responsePayload,
      status: response.ok ? "success" : "error",
      error: response.ok ? null : `Webhook failed (${response.status})`,
    });
  } catch (error) {
    await writeSouqnaIntegrationLog({
      orgId: input.orgId,
      storeId: input.order.store_id,
      direction: "outbound",
      endpoint,
      requestType: "orders.status_callback",
      requestPayload: payload,
      status: "error",
      error: error instanceof Error ? error.message : "Webhook request failed",
    });
  }
}

export async function sendSouqnaOrderReceivedWebhook(input: {
  order: OnlineOrder;
  orgId: string;
}): Promise<void> {
  await notifySouqnaOrderStatusChange({
    order: input.order,
    orgId: input.orgId,
    status: "pending",
  });
}
