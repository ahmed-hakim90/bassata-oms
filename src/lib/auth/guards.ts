import { cookies } from "next/headers";
import * as sessionRepo from "@/lib/repositories/session.repository";
import type { AppUser } from "@/lib/types";
import type { UserRole } from "@/lib/constants";
import type { FeatureFlag, PermissionKey } from "@/lib/constants";
import { getFeatureFlags, isFeatureEnabled } from "@/modules/system/services/settings.service";
import * as permissionRepo from "@/lib/repositories/permission.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import {
  CASHIER_COOKIE,
  getCurrentUser,
  REGISTERED_DEVICE_COOKIE,
  STORE_COOKIE,
} from "@/lib/auth/session";

export class AuthError extends Error {
  constructor(
    message: string,
    public status = 403
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireAuth(): Promise<AppUser> {
  const appUser = await getCurrentUser();
  if (!appUser) throw new AuthError("Not authenticated", 401);
  if (!appUser.is_active) throw new AuthError("User not found or inactive", 401);
  return appUser;
}

export async function requireRole(roles: UserRole[]): Promise<AppUser> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    throw new AuthError("Insufficient permissions");
  }
  return user;
}

export async function requireFeature(flag: FeatureFlag): Promise<void> {
  if (!(await isFeatureEnabled(flag))) {
    throw new AuthError(`Feature disabled: ${flag}`, 403);
  }
}

/** One flags load for multiple checks (avoids repeat settings reads in hot paths). */
export async function requireFeatures(flags: FeatureFlag[]): Promise<void> {
  if (flags.length === 0) return;
  const enabled = await getFeatureFlags();
  for (const flag of flags) {
    if (enabled[flag] === false) {
      throw new AuthError(`Feature disabled: ${flag}`, 403);
    }
  }
}

export async function requireAnyRole(roles: UserRole[]): Promise<AppUser> {
  return requireRole(roles);
}

export async function requirePermission(key: PermissionKey): Promise<AppUser> {
  const user = await requireAuth();
  if (user.role === "owner") return user;
  const allowed = await permissionRepo.hasPermission(key);
  if (!allowed) throw new AuthError("Insufficient permissions");
  return user;
}

export async function requireAnyPermission(keys: PermissionKey[]): Promise<AppUser> {
  const user = await requireAuth();
  if (user.role === "owner") return user;
  for (const key of keys) {
    if (await permissionRepo.hasPermission(key)) return user;
  }
  throw new AuthError("Insufficient permissions");
}

/** Read catalog/products: inventory, product admin, or POS operators. */
export async function requireCatalogRead(): Promise<AppUser> {
  try {
    return await requireAnyPermission(["product_manage", "inventory_view"]);
  } catch {
    return requirePermissionOrRole("pos_access", ["owner", "manager", "cashier"]);
  }
}

/** Permission check with role fallback when RBAC tables are not seeded yet. */
export async function requirePermissionOrRole(
  key: PermissionKey,
  roles: UserRole[]
): Promise<AppUser>;
export async function requirePermissionOrRole(roles: UserRole[]): Promise<AppUser>;
export async function requirePermissionOrRole(
  keyOrRoles: PermissionKey | UserRole[],
  roles?: UserRole[]
): Promise<AppUser> {
  if (Array.isArray(keyOrRoles)) {
    return requireRole(keyOrRoles);
  }
  if (!roles) throw new AuthError("Insufficient permissions");
  const user = await requireAuth();
  if (user.role === "owner") return user;
  if (await permissionRepo.hasPermission(keyOrRoles)) return user;
  const rbacSeeded = await permissionRepo.isRbacSeeded();
  if (!rbacSeeded && roles.includes(user.role)) return user;
  throw new AuthError("Insufficient permissions");
}

export async function requireStoreAccess(storeId: string): Promise<AppUser> {
  const user = await requireAuth();
  const store = await storeRepo.getStore(storeId);
  if (!store) {
    throw new AuthError("Store access denied");
  }
  if (user.role === "owner" || user.role === "manager") return user;
  if (!user.store_ids.includes(storeId)) {
    throw new AuthError("Store access denied");
  }
  return user;
}

export async function requireActiveSession(storeId: string) {
  const session = await sessionRepo.getActiveSession(storeId);
  if (!session) throw new AuthError("Active cashier session required");
  return session;
}

export async function getValidatedActiveStoreId(): Promise<string> {
  const user = await requireAuth();
  const cookieStore = await cookies();
  const cookieStoreId = cookieStore.get(STORE_COOKIE)?.value;

  if (cookieStoreId) {
    await requireStoreAccess(cookieStoreId);
    return cookieStoreId;
  }

  const allStores = await storeRepo.listStores();
  const accessibleStore =
    user.role === "owner" || user.role === "manager"
      ? allStores[0]
      : allStores.find((store) => user.store_ids.includes(store.id));

  if (!accessibleStore) throw new AuthError("No active store selected");
  return accessibleStore.id;
}

export async function setActiveStoreCookie(storeId: string) {
  const cookieStore = await cookies();
  cookieStore.set(STORE_COOKIE, storeId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearOperationalCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(CASHIER_COOKIE);
}

export { STORE_COOKIE, REGISTERED_DEVICE_COOKIE, CASHIER_COOKIE };
