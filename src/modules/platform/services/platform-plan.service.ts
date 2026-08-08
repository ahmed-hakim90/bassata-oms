import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import type { PlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { auditAs } from "@/modules/platform/services/platform-audit.service";

export const PLATFORM_PLAN_KEY = "platform_plan";

export type PlatformPlanId = "free" | "starter" | "growth" | "enterprise" | "custom";

export type PlatformPlan = {
  plan: PlatformPlanId;
  max_stores: number | null;
  max_users: number | null;
  max_devices: number | null;
  /** White-label custom domain for the organization. Free plan defaults off. */
  allow_custom_domain: boolean;
  notes: string;
};

export const DEFAULT_PLATFORM_PLAN: PlatformPlan = {
  plan: "starter",
  max_stores: 3,
  max_users: 20,
  max_devices: 10,
  allow_custom_domain: true,
  notes: "",
};

export const PLATFORM_PLAN_PRESETS: Record<
  Exclude<PlatformPlanId, "custom">,
  Omit<PlatformPlan, "notes" | "plan"> & { plan: Exclude<PlatformPlanId, "custom"> }
> = {
  free: {
    plan: "free",
    max_stores: 1,
    max_users: 5,
    max_devices: 2,
    allow_custom_domain: false,
  },
  starter: {
    plan: "starter",
    max_stores: 3,
    max_users: 20,
    max_devices: 10,
    allow_custom_domain: true,
  },
  growth: {
    plan: "growth",
    max_stores: 10,
    max_users: 100,
    max_devices: 40,
    allow_custom_domain: true,
  },
  enterprise: {
    plan: "enterprise",
    max_stores: null,
    max_users: null,
    max_devices: null,
    allow_custom_domain: true,
  },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeLimit(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

export function normalizePlatformPlan(value: unknown): PlatformPlan {
  const raw = asRecord(value);
  const plan = (
    ["free", "starter", "growth", "enterprise", "custom"] as const
  ).includes(raw.plan as PlatformPlanId)
    ? (raw.plan as PlatformPlanId)
    : DEFAULT_PLATFORM_PLAN.plan;

  if (plan !== "custom" && PLATFORM_PLAN_PRESETS[plan]) {
    const preset = PLATFORM_PLAN_PRESETS[plan];
    return {
      ...preset,
      allow_custom_domain:
        typeof raw.allow_custom_domain === "boolean"
          ? raw.allow_custom_domain
          : preset.allow_custom_domain,
      notes: typeof raw.notes === "string" ? raw.notes : "",
    };
  }

  return {
    plan: "custom",
    max_stores: normalizeLimit(raw.max_stores),
    max_users: normalizeLimit(raw.max_users),
    max_devices: normalizeLimit(raw.max_devices),
    allow_custom_domain:
      typeof raw.allow_custom_domain === "boolean" ? raw.allow_custom_domain : true,
    notes: typeof raw.notes === "string" ? raw.notes : "",
  };
}

export async function getPlatformPlan(orgId: string): Promise<PlatformPlan> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_settings")
    .select("value")
    .eq("org_id", orgId)
    .eq("key", PLATFORM_PLAN_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return normalizePlatformPlan(data?.value ?? null);
}

export async function setPlatformPlan(
  platformAdmin: PlatformAdmin,
  orgId: string,
  plan: PlatformPlan
): Promise<PlatformPlan> {
  const normalized = normalizePlatformPlan(plan);
  const admin = createAdminClient();
  const { error } = await admin.from("app_settings").upsert(
    {
      org_id: orgId,
      key: PLATFORM_PLAN_KEY,
      value: normalized as unknown as Json,
    },
    { onConflict: "org_id,key" }
  );
  if (error) throw new Error(error.message);

  await auditAs(platformAdmin, {
    action: "org.plan_update",
    entityType: "organization",
    entityId: orgId,
    metadata: { ...normalized },
  });

  return normalized;
}

export type PlatformUsage = {
  stores: number;
  users: number;
  devices: number;
};

export async function getPlatformUsage(orgId: string): Promise<PlatformUsage> {
  const admin = createAdminClient();
  const [{ count: stores }, { count: users }, storesRes] = await Promise.all([
    admin
      .from("stores")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
    admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("is_active", true),
    admin.from("stores").select("id").eq("org_id", orgId),
  ]);

  const storeIds = (storesRes.data ?? []).map((s) => s.id);
  let devices = 0;
  if (storeIds.length) {
    const { count } = await admin
      .from("devices")
      .select("id", { count: "exact", head: true })
      .in("store_id", storeIds)
      .eq("is_active", true);
    devices = count ?? 0;
  }

  return {
    stores: stores ?? 0,
    users: users ?? 0,
    devices,
  };
}

export type PlatformUsagePressure = "ok" | "near" | "over";

export type PlatformOrgUsageRow = {
  org_id: string;
  org_name: string;
  org_status: string;
  currency: string;
  country: string;
  created_at: string;
  plan: PlatformPlan;
  usage: PlatformUsage;
  order_count: number;
  product_count: number;
  customer_count: number;
  database_bytes: number;
  last_order_at: string | null;
  pressure: {
    stores: PlatformUsagePressure;
    users: PlatformUsagePressure;
    devices: PlatformUsagePressure;
    worst: PlatformUsagePressure;
  };
};

export function usagePressure(
  current: number,
  limit: number | null
): PlatformUsagePressure {
  if (limit == null) return "ok";
  if (current >= limit) return "over";
  if (limit > 0 && current / limit >= 0.8) return "near";
  return "ok";
}

function worstPressure(
  ...levels: PlatformUsagePressure[]
): PlatformUsagePressure {
  if (levels.includes("over")) return "over";
  if (levels.includes("near")) return "near";
  return "ok";
}

/**
 * Cross-tenant plan consumption for the platform usage console.
 * Capacity counts match assertPlatformCapacity (active users/devices).
 */
export async function listPlatformUsageMatrix(): Promise<PlatformOrgUsageRow[]> {
  const {
    listOrganizationHealthSummaries,
  } = await import("@/modules/platform/services/platform-org.service");
  const summaries = await listOrganizationHealthSummaries();
  if (summaries.length === 0) return [];

  const admin = createAdminClient();
  const orgIds = summaries.map((org) => org.id);

  const [plansRes, usersRes, storesRes] = await Promise.all([
    admin
      .from("app_settings")
      .select("org_id, value")
      .eq("key", PLATFORM_PLAN_KEY)
      .in("org_id", orgIds),
    admin.from("users").select("org_id").in("org_id", orgIds).eq("is_active", true),
    admin.from("stores").select("id, org_id").in("org_id", orgIds),
  ]);

  if (plansRes.error) throw new Error(plansRes.error.message);
  if (usersRes.error) throw new Error(usersRes.error.message);
  if (storesRes.error) throw new Error(storesRes.error.message);

  const planByOrg = new Map<string, PlatformPlan>();
  for (const row of plansRes.data ?? []) {
    planByOrg.set(row.org_id, normalizePlatformPlan(row.value));
  }

  const usersByOrg = new Map<string, number>();
  for (const row of usersRes.data ?? []) {
    usersByOrg.set(row.org_id, (usersByOrg.get(row.org_id) ?? 0) + 1);
  }

  const storesByOrg = new Map<string, string[]>();
  for (const store of storesRes.data ?? []) {
    const list = storesByOrg.get(store.org_id) ?? [];
    list.push(store.id);
    storesByOrg.set(store.org_id, list);
  }

  const allStoreIds = (storesRes.data ?? []).map((s) => s.id);
  const devicesByStore = new Map<string, number>();
  if (allStoreIds.length > 0) {
    const { data: devices, error: devicesError } = await admin
      .from("devices")
      .select("store_id")
      .in("store_id", allStoreIds)
      .eq("is_active", true);
    if (devicesError) throw new Error(devicesError.message);
    for (const device of devices ?? []) {
      devicesByStore.set(
        device.store_id,
        (devicesByStore.get(device.store_id) ?? 0) + 1
      );
    }
  }

  return summaries.map((org) => {
    const storeIds = storesByOrg.get(org.id) ?? [];
    const usage: PlatformUsage = {
      stores: storeIds.length,
      users: usersByOrg.get(org.id) ?? 0,
      devices: storeIds.reduce(
        (sum, storeId) => sum + (devicesByStore.get(storeId) ?? 0),
        0
      ),
    };
    const plan = planByOrg.get(org.id) ?? DEFAULT_PLATFORM_PLAN;
    const storesPressure = usagePressure(usage.stores, plan.max_stores);
    const usersPressure = usagePressure(usage.users, plan.max_users);
    const devicesPressure = usagePressure(usage.devices, plan.max_devices);

    return {
      org_id: org.id,
      org_name: org.name,
      org_status: org.status,
      currency: org.currency,
      country: org.country,
      created_at: org.created_at,
      plan,
      usage,
      order_count: org.health.orderCount,
      product_count: org.health.productCount,
      customer_count: org.health.customerCount,
      database_bytes: org.health.databaseBytes,
      last_order_at: org.health.lastOrderAt,
      pressure: {
        stores: storesPressure,
        users: usersPressure,
        devices: devicesPressure,
        worst: worstPressure(storesPressure, usersPressure, devicesPressure),
      },
    };
  });
}

export async function assertPlatformCapacity(
  orgId: string,
  kind: "stores" | "users" | "devices"
): Promise<void> {
  const [plan, usage] = await Promise.all([
    getPlatformPlan(orgId),
    getPlatformUsage(orgId),
  ]);

  const limit =
    kind === "stores"
      ? plan.max_stores
      : kind === "users"
        ? plan.max_users
        : plan.max_devices;
  if (limit == null) return;

  const current = usage[kind];
  if (current >= limit) {
    const labels = { stores: "الفروع", users: "المستخدمين", devices: "سجلات التشغيل" } as const;
    throw new Error(
      `وصلت الشركة للحد الأقصى من ${labels[kind]} حسب باقة المنصة (${current}/${limit}). تواصل مع مشرف المنصة.`
    );
  }
}
