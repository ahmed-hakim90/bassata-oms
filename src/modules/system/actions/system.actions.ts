"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionOrRole, requireRole, AuthError } from "@/lib/auth/guards";
import * as permissionRepo from "@/lib/repositories/permission.repository";
import { getAuditLogs } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import {
  getOrganizationSettings,
  getFeatureFlags,
  getSettings,
  getExpenseSettings,
  getSessionSettings,
  getBusinessActivitySettings,
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
  deleteStorePermanently,
  deleteUserPermanently,
  StoreDeleteBlockedError,
  UserDeleteBlockedError,
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
import type { FeatureFlag, PermissionKey, UserRole } from "@/lib/constants";
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
  revalidatePath("/", "layout");
}

export async function applyBusinessActivityPresetAction(
  activityType: import("@/lib/constants").BusinessActivityType
) {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  await applyActivityPreset(activityType, user.id);
  revalidatePath("/settings");
  revalidatePath("/pos");
  revalidatePath("/products");
  revalidatePath("/", "layout");
}

export async function updateProductTemplateSettingsAction(
  input: Partial<import("@/lib/constants").ProductTemplateSettings>
) {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  await updateProductTemplateSettings(input, user.id);
  revalidatePath("/settings");
  revalidatePath("/products");
}

export interface CreateUserResult {
  success: boolean;
  error?: string;
}

function createUserErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "فشل إنشاء المستخدم";
  const normalized = message.toLowerCase();

  if (normalized.includes("password must be at least 8")) {
    return "كلمة المرور يجب أن تكون 8 أحرف أو أكثر.";
  }
  if (normalized.includes("already been registered") || normalized.includes("already exists")) {
    return "هذا البريد الإلكتروني مسجّل مسبقاً.";
  }
  if (normalized.includes("insufficient permissions")) {
    return "ليس لديك صلاحية إنشاء مستخدمين.";
  }
  if (normalized.includes("user not found or out of scope")) {
    return "تعذر ربط المستخدم بالفروع المحددة.";
  }
  if (normalized.includes("stores are out of scope")) {
    return "أحد الفروع المحددة غير متاح لحسابك.";
  }
  if (normalized.includes("pin must be 4 to 8 digits")) {
    return "رقم PIN يجب أن يكون من 4 إلى 8 أرقام.";
  }

  return "تعذر إنشاء المستخدم. حاول مرة أخرى.";
}

export async function createUserAction(input: {
  name: string;
  email: string;
  role: "owner" | "manager" | "cashier" | "inventory";
  storeIds: string[];
  deviceIds?: string[];
  pin?: string;
  password: string;
}): Promise<CreateUserResult> {
  let actor;
  try {
    actor = await requirePermissionOrRole("user_manage", ["owner"]);
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: "ليس لديك صلاحية إنشاء مستخدمين." };
    }
    return { success: false, error: createUserErrorMessage(error) };
  }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!name || !email || !password) {
    return { success: false, error: "الاسم والبريد الإلكتروني وكلمة المرور مطلوبة." };
  }
  if (password.length < 8) {
    return { success: false, error: "كلمة المرور يجب أن تكون 8 أحرف أو أكثر." };
  }
  if (input.role === "owner" && actor.role !== "owner") {
    return { success: false, error: "تعيين دور المالك متاح للمالك فقط." };
  }
  if (input.role === "cashier") {
    if (!input.pin || !/^[0-9]{4,8}$/.test(input.pin)) {
      return { success: false, error: "رقم PIN يجب أن يكون من 4 إلى 8 أرقام." };
    }
  }

  try {
    await createUser({
      ...input,
      name,
      email,
      password,
      userId: actor.id,
    });
    revalidatePath("/users");
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return { success: false, error: createUserErrorMessage(error) };
  }
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
): Promise<{ success: boolean; error?: string }> {
  let actor;
  try {
    actor = await requirePermissionOrRole("user_manage", ["owner"]);
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: "ليس لديك صلاحية تعديل المستخدمين." };
    }
    return { success: false, error: "تعذر تحديث المستخدم." };
  }

  if (input.role === "owner" && actor.role !== "owner") {
    return { success: false, error: "تعيين دور المالك متاح للمالك فقط." };
  }

  try {
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
      actor.id
    );
    revalidatePath("/users");
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحديث المستخدم";
    if (message.toLowerCase().includes("at least one active owner")) {
      return {
        success: false,
        error: "لازم يفضل مالك نشط واحد على الأقل. مش هتقدر تغيّر دور المالك الوحيد أو تعطّله.",
      };
    }
    return { success: false, error: "تعذر تحديث المستخدم. حاول مرة أخرى." };
  }
}

function userAdminAuthErrorMessage(
  action: "deactivate" | "delete" | "pin" | "password"
): string {
  if (action === "deactivate") return "ليس لديك صلاحية تعطيل المستخدمين.";
  if (action === "delete") return "ليس لديك صلاحية حذف المستخدمين.";
  if (action === "pin") return "ليس لديك صلاحية إعادة ضبط PIN.";
  return "ليس لديك صلاحية إعادة ضبط كلمة المرور.";
}

export async function deactivateUserAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  let actor;
  try {
    actor = await requirePermissionOrRole("user_manage", ["owner"]);
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: userAdminAuthErrorMessage("deactivate") };
    }
    return { success: false, error: "تعذر تعطيل المستخدم." };
  }

  try {
    await deactivateUser(id, actor.id);
    revalidatePath("/users");
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      message.includes("مالك نشط") ||
      message.toLowerCase().includes("at least one active owner")
    ) {
      return {
        success: false,
        error: "لازم يفضل مالك نشط واحد على الأقل. مش هتقدر تعطّل المالك الوحيد.",
      };
    }
    return { success: false, error: "تعذر تعطيل المستخدم." };
  }
}

export async function deleteUserPermanentlyAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  let actor;
  try {
    actor = await requirePermissionOrRole("user_manage", ["owner"]);
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: userAdminAuthErrorMessage("delete") };
    }
    return { success: false, error: "تعذر حذف المستخدم." };
  }

  try {
    await deleteUserPermanently(id, actor.id);
    revalidatePath("/users");
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    if (error instanceof UserDeleteBlockedError) {
      return { success: false, error: error.message };
    }
    const message = error instanceof Error ? error.message : "";
    if (message.includes("مالك نشط")) {
      return {
        success: false,
        error: "لازم يفضل مالك نشط واحد على الأقل. مش هتقدر تمسح المالك الوحيد.",
      };
    }
    if (message) {
      return { success: false, error: message };
    }
    return { success: false, error: "تعذر حذف المستخدم نهائيًا." };
  }
}

export async function resetUserPinAction(
  id: string,
  pin: string
): Promise<{ success: boolean; error?: string }> {
  if (!/^[0-9]{4,8}$/.test(pin)) {
    return { success: false, error: "رقم PIN يجب أن يكون من 4 إلى 8 أرقام." };
  }

  let actor;
  try {
    actor = await requirePermissionOrRole("user_manage", ["owner"]);
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: userAdminAuthErrorMessage("pin") };
    }
    return { success: false, error: "تعذرت إعادة ضبط PIN." };
  }

  try {
    await resetUserPin(id, pin, actor.id);
    revalidatePath("/users");
    revalidatePath("/settings");
    return { success: true };
  } catch {
    return { success: false, error: "تعذرت إعادة ضبط PIN." };
  }
}

export async function resetUserPasswordAction(
  id: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  if (password.length < 8) {
    return { success: false, error: "كلمة المرور يجب أن تكون 8 أحرف أو أكثر." };
  }

  let actor;
  try {
    actor = await requirePermissionOrRole("user_manage", ["owner"]);
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: userAdminAuthErrorMessage("password") };
    }
    return { success: false, error: "تعذرت إعادة ضبط كلمة المرور." };
  }

  try {
    await resetUserPassword(id, password, actor.id);
    revalidatePath("/users");
    revalidatePath("/settings");
    return { success: true };
  } catch {
    return { success: false, error: "تعذرت إعادة ضبط كلمة المرور." };
  }
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

export async function deleteStorePermanentlyAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  let actor;
  try {
    actor = await requireRole(["owner"]);
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: "الحذف النهائي للفرع متاح للمالك فقط." };
    }
    return { success: false, error: "تعذر حذف الفرع." };
  }

  try {
    await deleteStorePermanently(id, actor.id);
    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    if (error instanceof StoreDeleteBlockedError) {
      return { success: false, error: error.message };
    }
    const message = error instanceof Error ? error.message : "";
    if (message) {
      return { success: false, error: message };
    }
    return { success: false, error: "تعذر حذف الفرع نهائيًا." };
  }
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
    onlineMenu?: {
      enabled?: boolean;
      orderingEnabled?: boolean;
      slug?: string;
      unlisted?: boolean;
      regenerateToken?: boolean;
      orderingPaused?: boolean;
      orderingHours?: unknown;
      fulfillment?: unknown;
    };
  }
) {
  const user = await requirePermissionOrRole("settings_manage", ["owner", "manager"]);
  const existing = await listStores().then((stores) => stores.find((store) => store.id === id));
  if (!existing) {
    throw new Error("الفرع غير موجود");
  }

  let settings: Record<string, unknown> | undefined;
  if (input.onlineMenu) {
    const slug = input.onlineMenu.slug?.trim().toLowerCase();
    if (slug !== undefined) {
      if (slug.length < 2) {
        throw new Error("رابط المنيو قصير جدًا");
      }
      if (!/^[a-z0-9\u0600-\u06FF-]+$/i.test(slug)) {
        throw new Error("رابط المنيو يحتوي أحرفًا غير مسموحة");
      }
    }

    const nextToken = input.onlineMenu.regenerateToken
      ? crypto.randomUUID().replaceAll("-", "")
      : typeof existing.settings.online_menu_token === "string" &&
          existing.settings.online_menu_token.trim()
        ? existing.settings.online_menu_token
        : crypto.randomUUID().replaceAll("-", "");

    settings = {
      ...existing.settings,
      online_menu_enabled: input.onlineMenu.enabled ?? existing.settings.online_menu_enabled === true,
      online_menu_ordering_enabled:
        input.onlineMenu.orderingEnabled ??
        existing.settings.online_menu_ordering_enabled === true,
      online_menu_slug: slug || existing.settings.online_menu_slug,
      online_menu_unlisted:
        input.onlineMenu.unlisted ?? existing.settings.online_menu_unlisted === true,
      online_menu_token: nextToken,
    };

    if (input.onlineMenu.orderingPaused !== undefined) {
      settings.online_ordering_paused = input.onlineMenu.orderingPaused === true;
    }

    if (input.onlineMenu.orderingHours !== undefined) {
      const {
        validateOnlineOrderingHoursInput,
        serializeOnlineOrderingHours,
      } = await import("@/modules/online-menu/lib/online-ordering-hours");
      const validated = validateOnlineOrderingHoursInput(input.onlineMenu.orderingHours);
      settings.online_ordering_hours = serializeOnlineOrderingHours(validated);
    }

    if (input.onlineMenu.fulfillment !== undefined) {
      const {
        validateOnlineFulfillmentInput,
        serializeOnlineFulfillment,
      } = await import("@/modules/online-menu/lib/online-fulfillment");
      const validated = validateOnlineFulfillmentInput(input.onlineMenu.fulfillment);
      settings.online_fulfillment = serializeOnlineFulfillment(validated);
    }
  }

  try {
    const store = await updateStore(
      id,
      {
        name: input.name,
        code: input.code,
        address: input.address,
        phone: input.phone,
        timezone: input.timezone,
        isActive: input.isActive,
        settings,
      },
      user.id
    );
    revalidatePath("/settings");
    revalidatePath("/", "layout");
    revalidatePath("/menu", "layout");
    return store;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      message.includes("stores_online_menu_slug_lower_uidx") ||
      message.includes("online_menu_slug") ||
      message.includes("duplicate key")
    ) {
      throw new Error("رابط المنيو مستخدم بالفعل — اختر رابطًا آخر");
    }
    throw error;
  }
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
  const [
    org,
    businessActivity,
    featureFlags,
    expenseSettings,
    sessionSettings,
    costCenters,
    stores,
    warehouses,
    devices,
    settings,
  ] = await Promise.all([
    getOrganizationSettings(),
    getBusinessActivitySettings(),
    getFeatureFlags(),
    getExpenseSettings(),
    getSessionSettings(),
    listCostCenters(),
    listStores(),
    warehouseRepo.listWarehouses(),
    listDevices(),
    getSettings(),
  ]);
  return {
    org,
    businessActivity,
    featureFlags,
    expenseSettings,
    sessionSettings,
    costCenters,
    stores,
    warehouses,
    devices,
    settings,
  };
}

async function loadUsersBundle() {
  const [users, stores, devices] = await Promise.all([
    listUsers(),
    listStores(),
    listDevices(),
  ]);
  const cashierIds = users.filter((u) => u.role === "cashier").map((u) => u.id);
  const nonOwnerIds = users.filter((u) => u.role !== "owner").map((u) => u.id);
  const { getDeviceIdsForUsers } = await import("@/lib/repositories/device.repository");
  const [deviceIdsByUser, permissionsBase, grantsByUser] = await Promise.all([
    getDeviceIdsForUsers(cashierIds),
    (async () => {
      try {
        const { getPermissionsData } = await import(
          "@/modules/accounting/actions/permission.actions"
        );
        return await getPermissionsData();
      } catch {
        return null;
      }
    })(),
    permissionRepo.getUserPermissionGrantsForUsers(nonOwnerIds),
  ]);

  const userDeviceIds: Record<string, string[]> = {};
  for (const id of cashierIds) {
    userDeviceIds[id] = deviceIdsByUser.get(id) ?? [];
  }

  let permissionsData = null;
  if (permissionsBase) {
    const userGrants: Record<string, { permission_key: string; granted: boolean }[]> = {};
    for (const id of nonOwnerIds) {
      userGrants[id] = grantsByUser.get(id) ?? [];
    }
    permissionsData = { ...permissionsBase, userGrants };
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
    actorRole?: UserRole;
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

  const needsSettingsBundle =
    has("settings_manage") &&
    (activeTab === "business" ||
      activeTab === "activity" ||
      activeTab === "branches" ||
      activeTab === "pos" ||
      activeTab === "expenses" ||
      activeTab === "features");

  const settingsBundle = needsSettingsBundle ? await loadSettingsBundle() : null;

  const sessionOnly =
    activeTab === "pos" &&
    !has("settings_manage") &&
    has("session_settings_manage") &&
    settingsBundle === null;

  let sessionSettings = settingsBundle?.sessionSettings ?? null;
  let featureFlags = settingsBundle?.featureFlags ?? null;
  let receiptHeader = "";
  let receiptFooter = "Thank you for visiting Velora!";

  if (sessionOnly) {
    const [session, flags, settings] = await Promise.all([
      getSessionSettings(),
      getFeatureFlags(),
      getSettings(),
    ]);
    sessionSettings = session;
    featureFlags = flags;
    const header = settings.find((s) => s.key === "receipt_header");
    const receipt = settings.find((s) => s.key === "receipt_footer");
    receiptHeader = (header?.value.text as string) ?? "";
    receiptFooter =
      (receipt?.value.text as string) ?? "Thank you for visiting Velora!";
  }

  if (settingsBundle) {
    const header = settingsBundle.settings.find((s) => s.key === "receipt_header");
    const receipt = settingsBundle.settings.find((s) => s.key === "receipt_footer");
    receiptHeader = (header?.value.text as string) ?? "";
    receiptFooter =
      (receipt?.value.text as string) ?? "Thank you for visiting Velora!";
  }

  const usersBundle =
    has("user_manage") && activeTab === "users"
      ? {
          ...(await loadUsersBundle()),
          actorRole:
            options.actorRole ?? (options.isOwner ? ("owner" as const) : ("manager" as const)),
        }
      : null;

  const costCentersBundle =
    has("cost_center_manage") && activeTab === "expenses"
      ? await loadCostCentersBundle().catch(() => null)
      : null;

  const auditBundle =
    has("audit_view") && activeTab === "audit"
      ? await (async () => {
          const orgId = await getOrgId();
          const page = Math.max(1, options.auditFilters?.page ?? 1);
          const pageSize = 50;
          const [logs, users, stores] = await Promise.all([
            getAuditLogs({
              orgId,
              storeId: options.auditFilters?.storeId,
              userId: options.auditFilters?.userId,
              action: options.auditFilters?.action,
              from: options.auditFilters?.from,
              to: options.auditFilters?.to,
              limit: pageSize,
              offset: (page - 1) * pageSize,
            }),
            listUsers(),
            listStores(),
          ]);
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
    receiptHeader,
    receiptFooter,
    settingsBundle,
    sessionSettings,
    featureFlags,
    usersBundle,
    costCentersBundle,
    auditBundle,
  };
}
