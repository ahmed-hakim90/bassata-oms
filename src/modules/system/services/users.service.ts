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
        await admin.from("users").delete().eq("id", appUserId);
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
  if (existing?.role === "owner" && (input.role || input.is_active === false)) {
    const owners = (await userRepo.listUsers()).filter(
      (u) => u.role === "owner" && u.is_active && u.id !== id
    );
    if (owners.length === 0) {
      throw new Error("At least one active owner is required");
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
      throw new Error("At least one active owner is required");
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
