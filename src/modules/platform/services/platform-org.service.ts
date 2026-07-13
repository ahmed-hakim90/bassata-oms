import { createAdminClient } from "@/lib/supabase/admin";
import type { PlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { writePlatformAuditLog } from "@/modules/platform/services/platform-audit.service";

export type PlatformOrganizationRow = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  currency: string;
  country: string;
};

export type PlatformOrganizationHealth = {
  storeCount: number;
  userCount: number;
  productCount: number;
  customerCount: number;
  orderCount: number;
  expenseCount: number;
  purchaseCount: number;
  inventoryMovementCount: number;
  auditLogCount: number;
  databaseBytes: number;
  deviceCount: number;
  lastOrderAt: string | null;
};

export type PlatformOrganizationSummary = PlatformOrganizationRow & {
  health: PlatformOrganizationHealth;
};

export type PlatformRollup = {
  orgTotal: number;
  orgActive: number;
  orgSuspended: number;
  pendingInvites: number;
  storeTotal: number;
  userTotal: number;
  orderTotal: number;
  deviceTotal: number;
};

function emptyHealth(): PlatformOrganizationHealth {
  return {
    storeCount: 0,
    userCount: 0,
    productCount: 0,
    customerCount: 0,
    orderCount: 0,
    expenseCount: 0,
    purchaseCount: 0,
    inventoryMovementCount: 0,
    auditLogCount: 0,
    databaseBytes: 0,
    deviceCount: 0,
    lastOrderAt: null,
  };
}

function asCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseHealthRpc(raw: unknown): Omit<
  PlatformOrganizationHealth,
  "deviceCount" | "lastOrderAt"
> {
  const data =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    storeCount: asCount(data.store_count),
    userCount: asCount(data.user_count),
    productCount: asCount(data.product_count),
    customerCount: asCount(data.customer_count),
    orderCount: asCount(data.order_count),
    expenseCount: asCount(data.expense_count),
    purchaseCount: asCount(data.purchase_count),
    inventoryMovementCount: asCount(data.inventory_movement_count),
    auditLogCount: asCount(data.audit_log_count),
    databaseBytes: asCount(data.database_bytes),
  };
}

export async function listOrganizationsForPlatform(): Promise<PlatformOrganizationRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("id, name, status, created_at, currency, country")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`organizations list failed: ${error.message}`);
  return data ?? [];
}

export async function getOrganizationForPlatform(
  orgId: string
): Promise<PlatformOrganizationRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("id, name, status, created_at, currency, country")
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw new Error(`organization lookup failed: ${error.message}`);
  return data;
}

async function loadOrgStoreIds(
  orgId: string
): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("stores").select("id").eq("org_id", orgId);
  if (error) throw new Error(`stores lookup failed: ${error.message}`);
  return (data ?? []).map((row) => row.id);
}

async function loadDeviceCount(storeIds: string[]): Promise<number> {
  if (storeIds.length === 0) return 0;
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("devices")
    .select("id", { count: "exact", head: true })
    .in("store_id", storeIds);
  if (error) throw new Error(`devices count failed: ${error.message}`);
  return count ?? 0;
}

async function loadLastOrderAt(storeIds: string[]): Promise<string | null> {
  if (storeIds.length === 0) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select("created_at")
    .in("store_id", storeIds)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`orders last activity failed: ${error.message}`);
  return data?.created_at ?? null;
}

export async function getOrganizationHealth(
  orgId: string
): Promise<PlatformOrganizationHealth> {
  const admin = createAdminClient();
  const storeIds = await loadOrgStoreIds(orgId);

  const [rpcResult, deviceCount, lastOrderAt] = await Promise.all([
    admin.rpc("platform_organization_data_size", { p_org_id: orgId }),
    loadDeviceCount(storeIds),
    loadLastOrderAt(storeIds),
  ]);

  if (rpcResult.error) {
    throw new Error(`organization health failed: ${rpcResult.error.message}`);
  }

  return {
    ...parseHealthRpc(rpcResult.data),
    deviceCount,
    lastOrderAt,
  };
}

export async function listOrganizationHealthSummaries(): Promise<
  PlatformOrganizationSummary[]
> {
  const orgs = await listOrganizationsForPlatform();
  if (orgs.length === 0) return [];

  const admin = createAdminClient();
  const { data: stores, error: storesError } = await admin
    .from("stores")
    .select("id, org_id")
    .in(
      "org_id",
      orgs.map((org) => org.id)
    );
  if (storesError) throw new Error(`stores list failed: ${storesError.message}`);

  const storeIdsByOrg = new Map<string, string[]>();
  for (const org of orgs) storeIdsByOrg.set(org.id, []);
  for (const store of stores ?? []) {
    const list = storeIdsByOrg.get(store.org_id);
    if (list) list.push(store.id);
  }

  const allStoreIds = (stores ?? []).map((s) => s.id);

  const [devicesResult, ...healthAndActivity] = await Promise.all([
    allStoreIds.length === 0
      ? Promise.resolve({ data: [] as { store_id: string }[], error: null })
      : admin.from("devices").select("store_id").in("store_id", allStoreIds),
    ...orgs.map(async (org) => {
      const storeIds = storeIdsByOrg.get(org.id) ?? [];
      const [rpc, lastOrderAt] = await Promise.all([
        admin.rpc("platform_organization_data_size", { p_org_id: org.id }),
        loadLastOrderAt(storeIds),
      ]);
      return { orgId: org.id, rpc, lastOrderAt };
    }),
  ]);

  if (devicesResult.error) {
    throw new Error(`devices list failed: ${devicesResult.error.message}`);
  }

  const deviceCountByStore = new Map<string, number>();
  for (const device of devicesResult.data ?? []) {
    deviceCountByStore.set(
      device.store_id,
      (deviceCountByStore.get(device.store_id) ?? 0) + 1
    );
  }

  const activityByOrg = new Map(
    healthAndActivity.map((row) => [row.orgId, row] as const)
  );

  return orgs.map((org) => {
    const activity = activityByOrg.get(org.id);
    if (!activity) {
      return { ...org, health: emptyHealth() };
    }
    if (activity.rpc.error) {
      throw new Error(
        `organization health failed (${org.name}): ${activity.rpc.error.message}`
      );
    }
    const storeIds = storeIdsByOrg.get(org.id) ?? [];
    const deviceCount = storeIds.reduce(
      (sum, storeId) => sum + (deviceCountByStore.get(storeId) ?? 0),
      0
    );
    return {
      ...org,
      health: {
        ...parseHealthRpc(activity.rpc.data),
        deviceCount,
        lastOrderAt: activity.lastOrderAt,
      },
    };
  });
}

export function getPlatformRollup(
  summaries: PlatformOrganizationSummary[],
  pendingInvites: number
): PlatformRollup {
  let storeTotal = 0;
  let userTotal = 0;
  let orderTotal = 0;
  let deviceTotal = 0;
  let orgActive = 0;
  let orgSuspended = 0;

  for (const row of summaries) {
    if (row.status === "suspended") orgSuspended += 1;
    else orgActive += 1;
    storeTotal += row.health.storeCount;
    userTotal += row.health.userCount;
    orderTotal += row.health.orderCount;
    deviceTotal += row.health.deviceCount;
  }

  return {
    orgTotal: summaries.length,
    orgActive,
    orgSuspended,
    pendingInvites,
    storeTotal,
    userTotal,
    orderTotal,
    deviceTotal,
  };
}

export async function setOrganizationStatus(
  platformAdmin: PlatformAdmin,
  orgId: string,
  status: "active" | "suspended"
): Promise<PlatformOrganizationRow> {
  const admin = createAdminClient();
  const { data: before, error: beforeError } = await admin
    .from("organizations")
    .select("id, name, status, created_at, currency, country")
    .eq("id", orgId)
    .maybeSingle();
  if (beforeError) throw new Error(beforeError.message);
  if (!before) throw new Error("الشركة مش موجودة");

  if (before.status === status) return before;

  const { data, error } = await admin
    .from("organizations")
    .update({ status })
    .eq("id", orgId)
    .select("id, name, status, created_at, currency, country")
    .single();
  if (error) throw new Error(`organizations status update failed: ${error.message}`);

  await writePlatformAuditLog({
    platformAdminId: platformAdmin.id,
    action: status === "suspended" ? "organization.suspend" : "organization.reactivate",
    entityType: "organization",
    entityId: orgId,
    metadata: {
      org_name: data.name,
      previous_status: before.status,
      new_status: status,
    },
  });

  return data;
}
