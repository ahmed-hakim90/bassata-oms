import { createAdminClient } from "@/lib/supabase/admin";
import { roundMoney } from "@/lib/money";
import type { PlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { auditAs } from "@/modules/platform/services/platform-audit.service";

const ACTIVE_ONLINE_ORDER_STATUSES = [
  "pending",
  "accepted",
  "preparing",
  "ready",
] as const;

export type PlatformDeviceRow = {
  id: string;
  name: string;
  is_active: boolean;
  last_seen_at: string | null;
  store_id: string;
  store_name: string;
  org_id: string;
  org_name: string;
};

export type PlatformOpenSessionRow = {
  id: string;
  store_id: string;
  store_name: string;
  org_id: string;
  org_name: string;
  cashier_id: string;
  cashier_name: string;
  device_id: string | null;
  device_name: string | null;
  opened_at: string;
  opening_cash: number;
};

export type PlatformOnlineOrderRow = {
  id: string;
  store_id: string;
  store_name: string;
  org_id: string;
  org_name: string;
  status: string;
  customer_name: string;
  customer_phone: string | null;
  total: number;
  fulfillment_type: string | null;
  created_at: string;
};

export type PlatformStockAlertRow = {
  id: string;
  product_name: string;
  quantity: number;
  reorder_point: number;
  store_id: string;
  store_name: string;
  org_id: string;
  org_name: string;
  warehouse_id: string;
  severity: "danger" | "warning";
};

export type PlatformEmailStatus = {
  configured: boolean;
  from: string | null;
  replyTo: string | null;
  note: string;
};

export function getPlatformEmailStatus(): PlatformEmailStatus {
  const apiKey = Boolean(process.env.RESEND_API_KEY?.trim());
  const from = process.env.EMAIL_FROM?.trim() || null;
  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || null;
  const configured = apiKey && Boolean(from);
  return {
    configured,
    from,
    replyTo,
    note: configured
      ? "Resend جاهز. راقب التسليم من لوحة Resend Logs."
      : "RESEND_API_KEY أو EMAIL_FROM ناقص — الإيميلات هتتSKIP.",
  };
}

export async function listPlatformDevices(input?: {
  orgId?: string;
  search?: string;
  limit?: number;
}): Promise<PlatformDeviceRow[]> {
  const admin = createAdminClient();
  const limit = Math.min(Math.max(input?.limit ?? 300, 1), 500);

  let query = admin
    .from("devices")
    .select(
      "id, name, is_active, last_seen_at, store_id, stores!inner(id, name, org_id, organizations!inner(id, name))"
    )
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (input?.orgId) {
    query = query.eq("stores.org_id", input.orgId);
  }

  const search = input?.search?.trim();
  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`تعذر جلب الأجهزة: ${error.message}`);

  return (data ?? []).map((row) => {
    const store = row.stores as unknown as {
      id: string;
      name: string;
      org_id: string;
      organizations: { id: string; name: string };
    };
    return {
      id: row.id,
      name: row.name,
      is_active: row.is_active,
      last_seen_at: row.last_seen_at,
      store_id: row.store_id,
      store_name: store.name,
      org_id: store.org_id,
      org_name: store.organizations?.name ?? store.org_id,
    };
  });
}

export async function setPlatformDeviceActive(
  platformAdmin: PlatformAdmin,
  deviceId: string,
  isActive: boolean
): Promise<void> {
  const admin = createAdminClient();
  const { data: device, error } = await admin
    .from("devices")
    .select("id, name, store_id, stores!inner(org_id)")
    .eq("id", deviceId)
    .maybeSingle();
  if (error || !device) throw new Error(error?.message ?? "الجهاز غير موجود");

  const { error: updateError } = await admin
    .from("devices")
    .update({ is_active: isActive })
    .eq("id", deviceId);
  if (updateError) throw new Error(updateError.message);

  const store = device.stores as unknown as { org_id: string };
  await auditAs(platformAdmin, {
    action: isActive ? "device.activate" : "device.deactivate",
    entityType: "device",
    entityId: deviceId,
    metadata: {
      name: device.name,
      store_id: device.store_id,
      org_id: store.org_id,
    },
  });

  const { dispatchPlatformWebhook } = await import(
    "@/modules/platform/services/platform-webhooks.service"
  );
  void dispatchPlatformWebhook(
    store.org_id,
    isActive ? "device.activated" : "device.deactivated",
    {
      device_id: deviceId,
      name: device.name,
      store_id: device.store_id,
    }
  );
}

export async function listPlatformOpenSessions(limit = 200): Promise<PlatformOpenSessionRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cashier_sessions")
    .select(
      "id, store_id, cashier_id, device_id, opened_at, opening_cash, stores!inner(id, name, org_id, organizations!inner(id, name))"
    )
    .eq("status", "open")
    .order("opened_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`تعذر جلب الجلسات: ${error.message}`);

  const cashierIds = [...new Set((data ?? []).map((r) => r.cashier_id))];
  const deviceIds = [...new Set((data ?? []).map((r) => r.device_id).filter(Boolean))] as string[];

  const [cashiersRes, devicesRes] = await Promise.all([
    cashierIds.length
      ? admin.from("users").select("id, name").in("id", cashierIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    deviceIds.length
      ? admin.from("devices").select("id, name").in("id", deviceIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
  ]);

  if (cashiersRes.error) throw new Error(cashiersRes.error.message);
  if (devicesRes.error) throw new Error(devicesRes.error.message);

  const cashierMap = new Map((cashiersRes.data ?? []).map((u) => [u.id, u.name]));
  const deviceMap = new Map((devicesRes.data ?? []).map((d) => [d.id, d.name]));

  return (data ?? []).map((row) => {
    const store = row.stores as unknown as {
      id: string;
      name: string;
      org_id: string;
      organizations: { id: string; name: string };
    };
    return {
      id: row.id,
      store_id: row.store_id,
      store_name: store.name,
      org_id: store.org_id,
      org_name: store.organizations?.name ?? store.org_id,
      cashier_id: row.cashier_id,
      cashier_name: cashierMap.get(row.cashier_id) ?? row.cashier_id,
      device_id: row.device_id,
      device_name: row.device_id ? deviceMap.get(row.device_id) ?? null : null,
      opened_at: row.opened_at,
      opening_cash: Number(row.opening_cash) || 0,
    };
  });
}

export async function forceClosePlatformSession(
  platformAdmin: PlatformAdmin,
  input: { sessionId: string; closeReason: string; actualCash?: number }
): Promise<void> {
  const reason = input.closeReason.trim();
  if (reason.length < 3) throw new Error("سبب الإغلاق مطلوب");

  const admin = createAdminClient();
  const { data: session, error } = await admin
    .from("cashier_sessions")
    .select("id, store_id, cashier_id, opening_cash, status, stores!inner(org_id)")
    .eq("id", input.sessionId)
    .maybeSingle();
  if (error || !session) throw new Error(error?.message ?? "الجلسة غير موجودة");
  if (session.status !== "open") throw new Error("الجلسة مش مفتوحة");

  const expectedCash = roundMoney(Number(session.opening_cash) || 0);
  const actualCash = roundMoney(
    input.actualCash !== undefined ? input.actualCash : expectedCash
  );
  const variance = roundMoney(actualCash - expectedCash);
  const store = session.stores as unknown as { org_id: string };

  const { data: closed, error: closeError } = await admin
    .from("cashier_sessions")
    .update({
      closed_at: new Date().toISOString(),
      expected_cash: expectedCash,
      actual_cash: actualCash,
      variance,
      status: "closed",
      notes: `Platform force-close by ${platformAdmin.email}`,
      closed_by: null,
      close_reason: reason,
      force_closed: true,
    })
    .eq("id", input.sessionId)
    .eq("status", "open")
    .select("id")
    .maybeSingle();

  if (closeError) throw new Error(closeError.message);
  if (!closed) throw new Error("مقدرناش نقفل الجلسة — ممكن اتقفلت بالفعل");

  if (actualCash > 0) {
    const { error: vaultError } = await admin.rpc("cashier_vault_deposit_closing", {
      p_store_id: session.store_id,
      p_cashier_id: session.cashier_id,
      p_amount: actualCash,
      p_session_id: session.id,
    });
    if (vaultError) {
      console.error("[platform] vault deposit after force-close failed", vaultError.message);
    }
  }

  await auditAs(platformAdmin, {
    action: "session.force_closed",
    entityType: "cashier_session",
    entityId: session.id,
    metadata: {
      org_id: store.org_id,
      store_id: session.store_id,
      cashier_id: session.cashier_id,
      reason,
      expected_cash: expectedCash,
      actual_cash: actualCash,
      variance,
    },
  });

  const { dispatchPlatformWebhook } = await import(
    "@/modules/platform/services/platform-webhooks.service"
  );
  void dispatchPlatformWebhook(store.org_id, "session.force_closed", {
    session_id: session.id,
    store_id: session.store_id,
    cashier_id: session.cashier_id,
    reason,
    expected_cash: expectedCash,
    actual_cash: actualCash,
    variance,
  });
}

export async function listPlatformActiveOnlineOrders(
  limit = 150
): Promise<PlatformOnlineOrderRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("online_orders")
    .select(
      "id, store_id, status, customer_name, customer_phone, total, fulfillment_type, created_at, stores!inner(id, name, org_id, organizations!inner(id, name))"
    )
    .in("status", [...ACTIVE_ONLINE_ORDER_STATUSES])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`تعذر جلب طلبات الأونلاين: ${error.message}`);

  return (data ?? []).map((row) => {
    const store = row.stores as unknown as {
      id: string;
      name: string;
      org_id: string;
      organizations: { id: string; name: string };
    };
    return {
      id: row.id,
      store_id: row.store_id,
      store_name: store.name,
      org_id: store.org_id,
      org_name: store.organizations?.name ?? store.org_id,
      status: row.status,
      customer_name: row.customer_name,
      customer_phone: row.customer_phone,
      total: Number(row.total) || 0,
      fulfillment_type: row.fulfillment_type,
      created_at: row.created_at,
    };
  });
}

export async function listPlatformStockAlerts(limit = 100): Promise<PlatformStockAlertRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("stock_levels")
    .select(
      "id, quantity, reorder_point, store_id, warehouse_id, product_id, products!inner(name), stores!inner(id, name, org_id, organizations!inner(id, name))"
    )
    .gt("reorder_point", 0)
    .limit(Math.min(limit * 3, 400));
  if (error) throw new Error(`تعذر جلب تنبيهات المخزون: ${error.message}`);

  const rows = (data ?? [])
    .filter((row) => Number(row.quantity) <= Number(row.reorder_point))
    .slice(0, limit)
    .map((row) => {
      const store = row.stores as unknown as {
        id: string;
        name: string;
        org_id: string;
        organizations: { id: string; name: string };
      };
      const product = row.products as unknown as { name: string };
      const quantity = Number(row.quantity) || 0;
      return {
        id: row.id,
        product_name: product?.name ?? row.product_id,
        quantity,
        reorder_point: Number(row.reorder_point) || 0,
        store_id: row.store_id,
        store_name: store.name,
        org_id: store.org_id,
        org_name: store.organizations?.name ?? store.org_id,
        warehouse_id: row.warehouse_id,
        severity: (quantity <= 0 ? "danger" : "warning") as "danger" | "warning",
      };
    })
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "danger" ? -1 : 1;
      return a.quantity - b.quantity;
    });

  return rows;
}
