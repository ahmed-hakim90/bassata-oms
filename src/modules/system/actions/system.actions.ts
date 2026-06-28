"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionOrRole } from "@/lib/auth/guards";
import * as permissionRepo from "@/lib/repositories/permission.repository";
import { getAuditLogs } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import {
  getOrganizationSettings,
  getFeatureFlags,
  getSettings,
  getExpenseSettings,
  getSessionSettings,
  updateExpenseSettings,
  updateSessionSettings,
  updateOrganizationSettings,
  updateFeatureFlags,
  applyActivityPreset,
  updateBusinessActivitySettings,
  updateProductTemplateSettings,
  upsertSetting,
} from "@/modules/system/services/settings.service";
import {
  createStore,
  createDevice,
  createUser,
  deactivateUser,
  listDevices,
  listStores,
  listUsers,
  resetUserPin,
  resetUserPassword,
  deleteDevice,
  updateDevice,
  updateStore,
  updateUser,
} from "@/modules/system/services/users.service";
import type { FeatureFlag, PermissionKey } from "@/lib/constants";
import type { ExpenseSettings, SessionSettings } from "@/lib/types";
import { listCostCenters } from "@/modules/accounting/services/cost-center.service";
import { listExpenseCategories } from "@/modules/accounting/services/expense-category.service";
import { getValidatedActiveStoreId } from "@/lib/auth/guards";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import {
  getVisibleSettingsTabs,
  resolveSettingsTab,
  type SettingsTabId,
} from "@/modules/system/components/settings/settings-tabs";

export async function updateOrgSettingsAction(input: {
  name?: string;
  currency?: string;
  timezone?: string;
  country?: string;
  taxRate?: number;
  taxInclusive?: boolean;
  phone?: string;
  address?: string;
}) {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  await updateOrganizationSettings(input, user.id);
  revalidatePath("/settings");
}

export async function uploadOrganizationLogoAction(formData: FormData) {
  const user = await requirePermissionOrRole("settings_manage", ["owner"]);
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Logo file is required.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Logo must be 5 MB or smaller.");
  }

  const orgId = await getOrgId();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${orgId}/logo.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { getDb } = await import("@/lib/repositories/client");
  const db = await getDb();
  const { error: uploadError } = await db.storage.from("org-assets").upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) throw new Error(uploadError.message);

  const {
    data: { publicUrl },
  } = db.storage.from("org-assets").getPublicUrl(path);

  await updateOrganizationSettings({ logoUrl: publicUrl }, user.id);
  revalidatePath("/settings");
  return publicUrl;
}

const STORE_LOGO_MAX_BYTES = 5 * 1024 * 1024;
const STORE_LOGO_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function uploadStoreLogoAction(storeId: string, formData: FormData) {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  const store = (await listStores()).find((row) => row.id === storeId);
  if (!store) throw new Error("Store not found");

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Branch logo file is required.");
  }
  if (file.size > STORE_LOGO_MAX_BYTES) {
    throw new Error("Branch logo must be 5 MB or smaller.");
  }

  const ext = STORE_LOGO_EXTENSIONS[file.type];
  if (!ext) {
    throw new Error("Branch logo must be JPEG, PNG, WebP, or GIF.");
  }

  const orgId = await getOrgId();
  const path = `${orgId}/public/stores/${storeId}-logo.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { getDb } = await import("@/lib/repositories/client");
  const db = await getDb();
  const { error: uploadError } = await db.storage.from("org-assets").upload(path, buffer, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: true,
  });
  if (uploadError) throw new Error(uploadError.message);

  const {
    data: { publicUrl },
  } = db.storage.from("org-assets").getPublicUrl(path);

  await updateStore(
    storeId,
    {
      settings: {
        ...store.settings,
        online_menu_logo_url: publicUrl,
      },
    },
    user.id
  );
  revalidatePath("/settings");
  revalidatePath("/menu", "layout");
  return publicUrl;
}

export async function updateReceiptHeaderAction(text: string) {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  await upsertSetting("receipt_header", { text }, user.id);
  revalidatePath("/settings");
}

export async function updateReceiptFooterAction(text: string) {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  await upsertSetting("receipt_footer", { text }, user.id);
  revalidatePath("/settings");
}

export async function updateFeatureFlagsAction(flags: Partial<Record<FeatureFlag, boolean>>) {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  await updateFeatureFlags(flags, user.id);
  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

export async function updateBusinessActivitySettingsAction(
  input: Partial<import("@/lib/constants").BusinessActivitySettings>
) {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  await updateBusinessActivitySettings(input, user.id);
  revalidatePath("/settings");
  revalidatePath("/pos");
}

export async function applyBusinessActivityPresetAction(
  activityType: import("@/lib/constants").BusinessActivityType
) {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  await applyActivityPreset(activityType, user.id);
  revalidatePath("/settings");
  revalidatePath("/pos");
}

export async function updateProductTemplateSettingsAction(
  input: Partial<import("@/lib/constants").ProductTemplateSettings>
) {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  await updateProductTemplateSettings(input, user.id);
  revalidatePath("/settings");
  revalidatePath("/products");
}

export async function createUserAction(input: {
  name: string;
  email: string;
  role: "owner" | "manager" | "cashier" | "inventory";
  storeIds: string[];
  deviceIds?: string[];
  pin?: string;
  password: string;
}) {
  const user = await requirePermissionOrRole("user_manage", ["owner"]);
  await createUser({ ...input, userId: user.id });
  revalidatePath("/users");
  revalidatePath("/settings");
}

export async function updateUserAction(
  id: string,
  input: {
    name?: string;
    email?: string;
    role?: "owner" | "manager" | "cashier" | "inventory";
    storeIds?: string[];
    deviceIds?: string[];
    isActive?: boolean;
  }
) {
  const user = await requirePermissionOrRole("user_manage", ["owner"]);
  await updateUser(
    id,
    {
      name: input.name,
      email: input.email,
      role: input.role,
      store_ids: input.storeIds,
      deviceIds: input.deviceIds,
      is_active: input.isActive,
    },
    user.id
  );
  revalidatePath("/users");
  revalidatePath("/settings");
}

export async function deactivateUserAction(id: string) {
  const user = await requirePermissionOrRole("user_manage", ["owner"]);
  await deactivateUser(id, user.id);
  revalidatePath("/users");
  revalidatePath("/settings");
}

export async function resetUserPinAction(id: string, pin: string) {
  const user = await requirePermissionOrRole("user_manage", ["owner"]);
  await resetUserPin(id, pin, user.id);
  revalidatePath("/users");
  revalidatePath("/settings");
}

export async function resetUserPasswordAction(id: string, password: string) {
  const user = await requirePermissionOrRole("user_manage", ["owner"]);
  await resetUserPassword(id, password, user.id);
  revalidatePath("/users");
  revalidatePath("/settings");
}

export async function createStoreAction(input: {
  name: string;
  address: string;
  code?: string;
  phone?: string;
  timezone?: string;
}) {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  const store = await createStore(input, user.id);
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return store;
}

export async function updateStoreAction(
  id: string,
  input: {
    name?: string;
    code?: string;
    address?: string;
    phone?: string;
    timezone?: string;
    isActive?: boolean;
  }
) {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  const store = await updateStore(id, input, user.id);
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return store;
}

export async function createWarehouseAction(input: { storeId: string; name: string }) {
  await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  const warehouse = await warehouseRepo.createWarehouse({
    storeId: input.storeId,
    name: input.name,
  });
  revalidatePath("/settings");
  revalidatePath("/inventory");
  return warehouse;
}

export async function updateWarehouseAction(
  id: string,
  input: { name?: string; isActive?: boolean }
) {
  await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  const warehouse = await warehouseRepo.updateWarehouse(id, {
    name: input.name,
    is_active: input.isActive,
  });
  revalidatePath("/settings");
  revalidatePath("/inventory");
  return warehouse;
}

export async function setDefaultWarehouseAction(storeId: string, warehouseId: string) {
  await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  await warehouseRepo.setDefaultWarehouse(storeId, warehouseId);
  revalidatePath("/settings");
  revalidatePath("/inventory");
  revalidatePath("/pos");
}

export async function createDeviceAction(input: { storeId: string; name: string }) {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  const device = await createDevice(input, user.id);
  revalidatePath("/settings");
  return device;
}

export async function generateDevicePairingCodeAction(deviceId: string) {
  await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  const code = await import("@/lib/repositories/device.repository").then((m) =>
    m.createPairingCode(deviceId)
  );
  revalidatePath("/settings");
  return { code, expiresInMinutes: 15 };
}

export async function updateDeviceAction(
  id: string,
  input: { storeId?: string; name?: string; isActive?: boolean }
) {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  const device = await updateDevice(id, input, user.id);
  revalidatePath("/settings");
  revalidatePath("/pos");
  revalidatePath("/device/pair");
  return device;
}

export async function deleteDeviceAction(id: string) {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  const device = await deleteDevice(id, user.id);
  revalidatePath("/settings");
  revalidatePath("/pos");
  revalidatePath("/device/pair");
  return device;
}

export async function updateExpenseSettingsAction(
  input: Partial<ExpenseSettings>
) {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  await updateExpenseSettings(input, user.id);
  revalidatePath("/settings");
}

export async function updateSessionSettingsAction(
  input: Partial<SessionSettings>
) {
  const user = await requirePermissionOrRole("session_settings_manage", [
    "owner",
    "manager",
  ]);
  await updateSessionSettings(input, user.id);
  revalidatePath("/settings");
  revalidatePath("/sessions");
  revalidatePath("/pos");
}

export async function getSettingsData() {
  await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  return {
    org: await getOrganizationSettings(),
    settings: await getSettings(),
    featureFlags: await getFeatureFlags(),
    expenseSettings: await getExpenseSettings(),
    sessionSettings: await getSessionSettings(),
    costCenters: await listCostCenters(),
    stores: await listStores(),
    warehouses: await warehouseRepo.listWarehouses(),
    devices: await listDevices(),
  };
}

export async function getUsersData() {
  await requirePermissionOrRole("user_manage", ["owner", "manager"]);
  const users = await listUsers();
  const stores = await listStores();
  let permissionsData = null;
  try {
    const { getPermissionsData } = await import(
      "@/modules/accounting/actions/permission.actions"
    );
    const base = await getPermissionsData();
    const userGrants: Record<string, { permission_key: string; granted: boolean }[]> = {};
    await Promise.all(
      users
        .filter((u) => u.role !== "owner")
        .map(async (u) => {
          userGrants[u.id] = await permissionRepo.getUserPermissionGrants(u.id);
        })
    );
    permissionsData = { ...base, userGrants };
  } catch {
    permissionsData = null;
  }
  return { users, stores, permissionsData };
}

export async function getAuditData(filters?: {
  storeId?: string;
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
}) {
  await requirePermissionOrRole("audit_view", ["owner", "manager"]);
  const orgId = await getOrgId();
  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = 50;
  const logs = await getAuditLogs({
    orgId,
    storeId: filters?.storeId,
    userId: filters?.userId,
    action: filters?.action,
    from: filters?.from,
    to: filters?.to,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  const users = await listUsers();
  const stores = await listStores();
  return { logs, users, stores, page, pageSize, hasMore: logs.length === pageSize };
}

async function loadSettingsBundle() {
  return {
    org: await getOrganizationSettings(),
    featureFlags: await getFeatureFlags(),
    expenseSettings: await getExpenseSettings(),
    sessionSettings: await getSessionSettings(),
    costCenters: await listCostCenters(),
    stores: await listStores(),
    warehouses: await warehouseRepo.listWarehouses(),
    devices: await listDevices(),
    settings: await getSettings(),
  };
}

async function loadUsersBundle() {
  const users = await listUsers();
  const stores = await listStores();
  const devices = await listDevices();
  const userDeviceIds: Record<string, string[]> = {};
  await Promise.all(
    users
      .filter((u) => u.role === "cashier")
      .map(async (u) => {
        const { getUserDeviceIds } = await import("@/lib/repositories/device.repository");
        userDeviceIds[u.id] = await getUserDeviceIds(u.id);
      })
  );
  let permissionsData = null;
  try {
    const { getPermissionsData } = await import(
      "@/modules/accounting/actions/permission.actions"
    );
    const base = await getPermissionsData();
    const userGrants: Record<string, { permission_key: string; granted: boolean }[]> = {};
    await Promise.all(
      users
        .filter((u) => u.role !== "owner")
        .map(async (u) => {
          userGrants[u.id] = await permissionRepo.getUserPermissionGrants(u.id);
        })
    );
    permissionsData = { ...base, userGrants };
  } catch {
    permissionsData = null;
  }
  return { users, stores, devices, userDeviceIds, permissionsData };
}

async function loadCostCentersBundle() {
  const storeId = await getValidatedActiveStoreId();
  const [centers, categories] = await Promise.all([
    listCostCenters(storeId),
    listExpenseCategories(),
  ]);
  return { centers, categories, activeStoreId: storeId };
}

export async function getUnifiedSettingsData(
  permissions: Set<PermissionKey>,
  options: {
    isOwner: boolean;
    tab?: string;
    auditFilters?: {
      storeId?: string;
      userId?: string;
      action?: string;
      from?: string;
      to?: string;
      page?: number;
    };
  }
) {
  const has = (key: PermissionKey) => options.isOwner || permissions.has(key);

  const visibleTabs = getVisibleSettingsTabs(permissions, options.isOwner);
  const activeTab = resolveSettingsTab(options.tab, permissions, options.isOwner);

  const settingsBundle = has("settings_manage") ? await loadSettingsBundle() : null;

  const sessionOnly =
    !has("settings_manage") &&
    has("session_settings_manage") &&
    settingsBundle === null;

  let sessionSettings = settingsBundle?.sessionSettings ?? null;
  let featureFlags = settingsBundle?.featureFlags ?? null;
  let receiptFooter = "Thank you for visiting CafeFlow!";

  if (sessionOnly) {
    sessionSettings = await getSessionSettings();
    featureFlags = await getFeatureFlags();
  }

  if (settingsBundle) {
    const receipt = settingsBundle.settings.find((s) => s.key === "receipt_footer");
    receiptFooter =
      (receipt?.value.text as string) ?? "Thank you for visiting CafeFlow!";
  }

  const usersBundle = has("user_manage") ? await loadUsersBundle() : null;

  const costCentersBundle = has("cost_center_manage")
    ? await loadCostCentersBundle().catch(() => null)
    : null;

  const auditBundle = has("audit_view")
    ? await (async () => {
        const orgId = await getOrgId();
        const page = Math.max(1, options.auditFilters?.page ?? 1);
        const pageSize = 50;
        const logs = await getAuditLogs({
          orgId,
          storeId: options.auditFilters?.storeId,
          userId: options.auditFilters?.userId,
          action: options.auditFilters?.action,
          from: options.auditFilters?.from,
          to: options.auditFilters?.to,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        });
        const users = await listUsers();
        const stores = await listStores();
        return {
          logs,
          users,
          stores,
          page,
          pageSize,
          hasMore: logs.length === pageSize,
          initialFilters: {
            storeId: options.auditFilters?.storeId,
            userId: options.auditFilters?.userId,
            action: options.auditFilters?.action,
            from: options.auditFilters?.from,
            to: options.auditFilters?.to,
            page: options.auditFilters?.page?.toString(),
          },
        };
      })()
    : null;

  return {
    visibleTabs,
    activeTab: (visibleTabs.some((t) => t.id === activeTab)
      ? activeTab
      : visibleTabs[0]?.id ?? "business") as SettingsTabId,
    receiptFooter,
    settingsBundle,
    sessionSettings,
    featureFlags,
    usersBundle,
    costCentersBundle,
    auditBundle,
  };
}
