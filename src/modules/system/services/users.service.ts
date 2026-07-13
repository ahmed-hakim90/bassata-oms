import { slugifyBranchName } from "@/lib/slugify";
import * as userRepo from "@/lib/repositories/user.repository";
import * as deviceRepo from "@/lib/repositories/device.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppUser, Store } from "@/lib/types";
import type { UserRole } from "@/lib/constants";

export async function listUsers(): Promise<AppUser[]> {
  return userRepo.listUsers();
}

export async function getUser(id: string): Promise<AppUser | null> {
  return userRepo.getUser(id);
}

export async function createUser(input: {
  name: string;
  email: string;
  role: UserRole;
  storeIds: string[];
  deviceIds?: string[];
  pin?: string;
  password: string;
  userId: string;
}): Promise<AppUser> {
  if (input.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name, role: input.role },
  });
  if (authError || !authData.user) {
    throw new Error(authError?.message ?? "Failed to create Supabase Auth user");
  }

  const orgId = await getOrgId();
  const authUserId = authData.user.id;
  const storeIds = input.storeIds.filter(Boolean);
  const deviceIds = input.deviceIds?.filter(Boolean) ?? [];
  let appUserId: string | null = null;

  try {
    const { data: userRow, error: userError } = await admin
      .from("users")
      .insert({
        org_id: orgId,
        auth_user_id: authUserId,
        name: input.name,
        email: input.email,
        role: input.role,
        is_active: true,
      })
      .select("id")
      .single();

    if (userError || !userRow) {
      throw new Error(userError?.message ?? "Failed to create user profile");
    }

    appUserId = userRow.id;
    await storeRepo.setUserStoreAccess(appUserId, storeIds);

    const user = await userRepo.getUser(appUserId);
    if (!user) {
      throw new Error("Created user profile is not visible in the current organization");
    }

    if (input.pin && input.role === "cashier") {
      await userRepo.setPin(user.id, input.pin);
    }
    if (deviceIds.length) {
      await deviceRepo.setUserDeviceAccess(user.id, deviceIds);
    }

    await writeAuditLog({
      orgId,
      userId: input.userId,
      action: "user.created",
      entityType: "user",
      entityId: user.id,
    });
    return user;
  } catch (error) {
    try {
      if (appUserId) {
        await admin.from("users").delete().eq("id", appUserId).eq("org_id", orgId);
      }
      await admin.auth.admin.deleteUser(authUserId);
    } catch {
      // Keep the original creation error; cleanup failures are secondary here.
    }
    throw error;
  }
}

export async function resetUserPin(id: string, pin: string, userId: string): Promise<void> {
  const user = await userRepo.getUser(id);
  if (!user || user.role !== "cashier") throw new Error("Cashier not found");
  await userRepo.setPin(id, pin);
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    userId,
    action: "user.pin_reset",
    entityType: "user",
    entityId: id,
  });
}

export async function resetUserPassword(
  id: string,
  password: string,
  actorUserId: string
): Promise<void> {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  const user = await userRepo.getUser(id);
  if (!user?.auth_user_id) {
    throw new Error("User has no login account");
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.auth_user_id, { password });
  if (error) throw new Error(error.message);
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    userId: actorUserId,
    action: "user.password_reset",
    entityType: "user",
    entityId: id,
  });
}

export async function updateUser(
  id: string,
  input: Partial<Pick<AppUser, "name" | "email" | "role" | "is_active" | "store_ids">> & {
    deviceIds?: string[];
  },
  userId: string
): Promise<AppUser | null> {
  const existing = await userRepo.getUser(id);
  const demotingOwner =
    existing?.role === "owner" &&
    input.role !== undefined &&
    input.role !== "owner";
  const deactivatingOwner =
    existing?.role === "owner" && input.is_active === false;
  if (demotingOwner || deactivatingOwner) {
    const owners = (await userRepo.listUsers()).filter(
      (u) => u.role === "owner" && u.is_active && u.id !== id
    );
    if (owners.length === 0) {
      throw new Error("يجب الإبقاء على مالك نشط واحد على الأقل");
    }
  }
  const updated = await userRepo.updateUser(id, {
    name: input.name,
    email: input.email,
    role: input.role,
    is_active: input.is_active,
    storeIds: input.store_ids,
  });
  if (input.deviceIds !== undefined) {
    await deviceRepo.setUserDeviceAccess(id, input.deviceIds);
  }
  if (updated) {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      userId,
      action: "user.updated",
      entityType: "user",
      entityId: id,
    });
  }
  return updated;
}

export async function deactivateUser(id: string, userId: string): Promise<boolean> {
  const existing = await userRepo.getUser(id);
  if (existing?.role === "owner") {
    const owners = (await userRepo.listUsers()).filter(
      (u) => u.role === "owner" && u.is_active && u.id !== id
    );
    if (owners.length === 0) {
      throw new Error("يجب الإبقاء على مالك نشط واحد على الأقل");
    }
  }
  const updated = await userRepo.updateUser(id, { is_active: false });
  if (updated) {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      userId,
      action: "user.deactivated",
      entityType: "user",
      entityId: id,
    });
    return true;
  }
  return false;
}

/** Operational / financial history that must stay attributed to a real user row. */
const USER_DELETE_BLOCKING_REFS: { table: string; column: string; label: string }[] = [
  { table: "orders", column: "created_by", label: "طلبات بيع" },
  { table: "cashier_sessions", column: "cashier_id", label: "جلسات كاشير" },
  { table: "cashier_sessions", column: "closed_by", label: "إغلاق جلسات" },
  { table: "expenses", column: "created_by", label: "مصروفات" },
  { table: "expenses", column: "approved_by", label: "اعتماد مصروفات" },
  { table: "purchase_invoices", column: "created_by", label: "فواتير شراء" },
  { table: "supplier_payments", column: "created_by", label: "مدفوعات موردين" },
  { table: "customer_payments", column: "created_by", label: "تحصيل عملاء" },
  { table: "customer_ledger", column: "created_by", label: "دفتر عملاء" },
  { table: "inventory_movements", column: "created_by", label: "حركة مخزون" },
  { table: "stock_counts", column: "created_by", label: "جرد" },
  { table: "transfer_orders", column: "created_by", label: "تحويلات" },
  { table: "waste_records", column: "created_by", label: "هالك" },
  { table: "cashier_vault_ledger", column: "created_by", label: "خزنة كاشير" },
  { table: "import_jobs", column: "created_by", label: "استيراد بيانات" },
  { table: "pos_held_carts", column: "created_by", label: "سلاّت معلّقة" },
  { table: "device_pairing_codes", column: "created_by", label: "أكواد ربط أجهزة" },
];

export class UserDeleteBlockedError extends Error {
  constructor(public readonly blockers: string[]) {
    super(
      blockers.length > 0
        ? `لا يمكن الحذف النهائي — المستخدم له سجل: ${blockers.join("، ")}. استخدم التعطيل بدلًا من الحذف.`
        : "لا يمكن الحذف النهائي لهذا المستخدم."
    );
    this.name = "UserDeleteBlockedError";
  }
}

async function findUserDeleteBlockers(userId: string): Promise<string[]> {
  const admin = createAdminClient();
  const found: string[] = [];
  for (const ref of USER_DELETE_BLOCKING_REFS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error } = await (admin.from(ref.table as any) as any)
      .select("*", { count: "exact", head: true })
      .eq(ref.column, userId);
    if (error) {
      throw new Error(`تعذر التحقق من سجل المستخدم (${ref.label}): ${error.message}`);
    }
    if ((count ?? 0) > 0 && !found.includes(ref.label)) {
      found.push(ref.label);
    }
  }
  return found;
}

/**
 * Hard-delete a user when they have no operational/financial history.
 * Removes Auth + `users` row. Audit/PIN attempts for the target are cleaned so FKs allow delete.
 * If history exists → throws UserDeleteBlockedError (caller should keep soft-deactivate).
 */
export async function deleteUserPermanently(id: string, actorUserId: string): Promise<void> {
  if (id === actorUserId) {
    throw new Error("مش هتقدر تمسح حسابك وأنت مسجّل دخول به.");
  }

  const existing = await userRepo.getUser(id);
  if (!existing) {
    throw new Error("المستخدم غير موجود");
  }

  if (existing.role === "owner") {
    const owners = (await userRepo.listUsers()).filter(
      (u) => u.role === "owner" && u.is_active && u.id !== id
    );
    if (owners.length === 0) {
      throw new Error("يجب الإبقاء على مالك نشط واحد على الأقل");
    }
  }

  const blockers = await findUserDeleteBlockers(id);
  if (blockers.length > 0) {
    throw new UserDeleteBlockedError(blockers);
  }

  const orgId = await getOrgId();
  const admin = createAdminClient();

  await writeAuditLog({
    orgId,
    userId: actorUserId,
    action: "user.deleted_permanently",
    entityType: "user",
    entityId: id,
    metadata: {
      email: existing.email,
      name: existing.name,
      role: existing.role,
      auth_user_id: existing.auth_user_id,
    },
  });

  // Clear non-operational FK noise that would block DELETE (not financial history).
  const { error: pinAttemptsError } = await admin
    .from("pin_attempts")
    .delete()
    .eq("attempted_by", id);
  if (pinAttemptsError) {
    throw new Error(`تعذر تنظيف محاولات PIN: ${pinAttemptsError.message}`);
  }

  const { error: auditError } = await admin.from("audit_logs").delete().eq("user_id", id);
  if (auditError) {
    throw new Error(`تعذر تنظيف سجل التدقيق الخاص بالمستخدم: ${auditError.message}`);
  }

  const { error: userDeleteError } = await admin
    .from("users")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);
  if (userDeleteError) {
    throw new Error(`تعذر حذف المستخدم من قاعدة البيانات: ${userDeleteError.message}`);
  }

  if (existing.auth_user_id) {
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(existing.auth_user_id);
    if (authDeleteError) {
      throw new Error(
        `اتمسك صف المستخدم لكن فشل حذف حساب الدخول: ${authDeleteError.message}`
      );
    }
  }
}

/** Operational / financial history that must stay attributed to a real store row. */
const STORE_DELETE_BLOCKING_REFS: { table: string; column: string; label: string }[] = [
  { table: "orders", column: "store_id", label: "طلبات بيع" },
  { table: "cashier_sessions", column: "store_id", label: "جلسات كاشير" },
  { table: "expenses", column: "store_id", label: "مصروفات" },
  { table: "purchase_invoices", column: "store_id", label: "فواتير شراء" },
  { table: "supplier_payments", column: "store_id", label: "مدفوعات موردين" },
  { table: "customer_payments", column: "store_id", label: "تحصيل عملاء" },
  { table: "customer_ledger", column: "store_id", label: "دفتر عملاء" },
  { table: "inventory_movements", column: "store_id", label: "حركة مخزون" },
  { table: "inventory_batches", column: "store_id", label: "دفعات مخزون" },
  { table: "stock_counts", column: "store_id", label: "جرد" },
  { table: "waste_records", column: "store_id", label: "هالك" },
  { table: "transfer_orders", column: "from_store_id", label: "تحويلات" },
  { table: "transfer_orders", column: "to_store_id", label: "تحويلات" },
  { table: "online_orders", column: "store_id", label: "طلبات أونلاين" },
  { table: "cashier_vault_ledger", column: "store_id", label: "خزنة كاشير" },
  { table: "pos_held_carts", column: "store_id", label: "سلاّت معلّقة" },
];

export class StoreDeleteBlockedError extends Error {
  constructor(public readonly blockers: string[]) {
    super(
      blockers.length > 0
        ? `لا يمكن الحذف النهائي — الفرع له سجل: ${blockers.join("، ")}. استخدم تعطيل «فرع نشط» بدلًا من الحذف.`
        : "لا يمكن الحذف النهائي لهذا الفرع."
    );
    this.name = "StoreDeleteBlockedError";
  }
}

async function findStoreDeleteBlockers(storeId: string): Promise<string[]> {
  const admin = createAdminClient();
  const found: string[] = [];
  for (const ref of STORE_DELETE_BLOCKING_REFS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error } = await (admin.from(ref.table as any) as any)
      .select("*", { count: "exact", head: true })
      .eq(ref.column, storeId);
    if (error) {
      throw new Error(`تعذر التحقق من سجل الفرع (${ref.label}): ${error.message}`);
    }
    if ((count ?? 0) > 0 && !found.includes(ref.label)) {
      found.push(ref.label);
    }
  }
  return found;
}

/**
 * Hard-delete a store when it has no operational/financial history.
 * Cascades scaffolding (default warehouse, devices, access). Audit store_id is nulled for FK.
 * If history exists → throws StoreDeleteBlockedError (caller should deactivate instead).
 */
export async function deleteStorePermanently(id: string, actorUserId: string): Promise<void> {
  const existing = await storeRepo.getStore(id);
  if (!existing) {
    throw new Error("الفرع غير موجود");
  }

  const stores = await storeRepo.listStores();
  if (stores.length <= 1) {
    throw new Error("لازم يفضل فرع واحد على الأقل في المنظمة.");
  }

  const blockers = await findStoreDeleteBlockers(id);
  if (blockers.length > 0) {
    throw new StoreDeleteBlockedError(blockers);
  }

  const orgId = await getOrgId();
  const admin = createAdminClient();

  await writeAuditLog({
    orgId,
    userId: actorUserId,
    action: "store.deleted_permanently",
    entityType: "store",
    entityId: id,
    metadata: {
      name: existing.name,
      code: existing.code,
    },
  });

  // audit_logs.store_id is RESTRICT — clear before DELETE so history can remain org-scoped.
  const { error: auditNullError } = await admin
    .from("audit_logs")
    .update({ store_id: null })
    .eq("store_id", id);
  if (auditNullError) {
    throw new Error(`تعذر تنظيف سجل التدقيق المرتبط بالفرع: ${auditNullError.message}`);
  }

  const { error: storeDeleteError } = await admin
    .from("stores")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);
  if (storeDeleteError) {
    throw new Error(`تعذر حذف الفرع من قاعدة البيانات: ${storeDeleteError.message}`);
  }
}

export async function listStores() {
  return storeRepo.listStores();
}

export async function listDevices() {
  return deviceRepo.listDevices();
}

export async function createDevice(
  input: { storeId: string; name: string },
  userId: string
) {
  const { device } = await deviceRepo.createDevice(input);
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: input.storeId,
    userId,
    action: "device.created",
    entityType: "device",
    entityId: device.id,
  });
  return device;
}

export async function updateDevice(
  id: string,
  input: { storeId?: string; name?: string; isActive?: boolean },
  userId: string
) {
  const device = await deviceRepo.updateDevice({ id, ...input });
  if (!device) {
    throw new Error("Device not found or update not allowed");
  }
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: device.store_id,
    userId,
    action: "device.updated",
    entityType: "device",
    entityId: device.id,
  });
  return device;
}

export async function deleteDevice(id: string, userId: string) {
  const device = await deviceRepo.deleteDevice(id);
  if (device) {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      storeId: device.store_id,
      userId,
      action: "device.deleted",
      entityType: "device",
      entityId: device.id,
    });
  }
  return device;
}

export async function createStore(
  input: {
    name: string;
    address: string;
    code?: string;
    phone?: string;
    timezone?: string;
  },
  userId: string
) {
  const orgId = await getOrgId();
  const slug = slugifyBranchName(input.name);
  const store = await storeRepo.createStore({
    name: input.name,
    address: input.address,
    code: input.code ?? slug,
    phone: input.phone ?? "",
    timezone: input.timezone ?? null,
    is_active: true,
    settings: {
      online_menu_enabled: true,
      online_menu_ordering_enabled: true,
      online_menu_slug: slug,
      online_menu_token: crypto.randomUUID().replaceAll("-", ""),
      online_menu_unlisted: false,
    },
  });
  await writeAuditLog({
    orgId,
    storeId: store.id,
    userId,
    action: "store.created",
    entityType: "store",
    entityId: store.id,
  });
  await warehouseRepo.createWarehouse({
    storeId: store.id,
    name: "Main warehouse",
    isDefault: true,
  });
  return store;
}

export async function updateStore(
  id: string,
  input: {
    name?: string;
    code?: string;
    address?: string;
    phone?: string;
    timezone?: string;
    isActive?: boolean;
    settings?: Record<string, unknown>;
  },
  userId: string
) {
  const existing = await storeRepo.getStore(id);
  if (!existing) return null;

  const patch: Partial<
    Pick<Store, "name" | "code" | "address" | "phone" | "timezone" | "is_active" | "settings">
  > = {
    name: input.name,
    code: input.code,
    address: input.address,
    phone: input.phone,
    timezone: input.timezone ?? undefined,
    is_active: input.isActive,
    settings: input.settings,
  };

  const store = await storeRepo.updateStore(id, patch);
  if (store) {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      storeId: store.id,
      userId,
      action: "store.updated",
      entityType: "store",
      entityId: store.id,
    });
  }
  return store;
}
