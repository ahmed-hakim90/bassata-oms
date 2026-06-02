import { createClient } from "@/lib/supabase/server";
import { getDb, throwDbError } from "@/lib/repositories/client";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { mapPermission } from "@/lib/repositories/mappers";
import type { Permission, PermissionKey } from "@/lib/types";
import type { UserRole } from "@/lib/constants";
import { PATH_PERMISSIONS } from "@/lib/constants";

function isMissingRbacSchema(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    msg.includes("permissions") ||
    msg.includes("role_permissions") ||
    msg.includes("schema cache")
  );
}

export async function listPermissions(): Promise<Permission[]> {
  const db = await getDb();
  const { data, error } = await db.from("permissions").select("*").order("group_name");
  if (error) {
    if (isMissingRbacSchema(error)) return [];
    throwDbError(error, "listPermissions");
  }
  return (data ?? []).map(mapPermission);
}

export async function getRolePermissions(
  orgId?: string
): Promise<{ role: UserRole; permission_key: string }[]> {
  const db = await getDb();
  const oid = orgId ?? (await getOrgId());
  const { data, error } = await db
    .from("role_permissions")
    .select("role, permission_key")
    .eq("org_id", oid);
  if (error) {
    if (isMissingRbacSchema(error)) return [];
    throwDbError(error, "getRolePermissions");
  }
  return (data ?? []) as { role: UserRole; permission_key: string }[];
}

export async function getUserPermissionGrants(
  userId: string
): Promise<{ permission_key: string; granted: boolean }[]> {
  const db = await getDb();
  const { data, error } = await db
    .from("user_permission_grants")
    .select("permission_key, granted")
    .eq("user_id", userId);
  if (error) {
    if (isMissingRbacSchema(error)) return [];
    throwDbError(error, "getUserPermissionGrants");
  }
  return data ?? [];
}

export async function isRbacSeeded(orgId?: string): Promise<boolean> {
  const rows = await getRolePermissions(orgId);
  return rows.length > 0;
}

export async function hasPermission(key: PermissionKey): Promise<boolean> {
  const db = await createClient();
  const { data, error } = await db.rpc("has_permission", { p_key: key });
  if (error) {
    if (isMissingRbacSchema(error)) return false;
    throwDbError(error, "hasPermission");
  }
  return Boolean(data);
}

export async function setRolePermissions(
  role: UserRole,
  permissionKeys: PermissionKey[]
): Promise<void> {
  const db = await getDb();
  const orgId = await getOrgId();
  await db
    .from("role_permissions")
    .delete()
    .eq("org_id", orgId)
    .eq("role", role);
  if (permissionKeys.length === 0) return;
  const { error } = await db.from("role_permissions").insert(
    permissionKeys.map((permission_key) => ({
      org_id: orgId,
      role,
      permission_key,
    }))
  );
  if (error) throwDbError(error, "setRolePermissions");
}

export async function setUserPermissionGrants(
  userId: string,
  grants: { permission_key: PermissionKey; granted: boolean }[]
): Promise<void> {
  const db = await getDb();
  await db.from("user_permission_grants").delete().eq("user_id", userId);
  if (grants.length === 0) return;
  const { error } = await db.from("user_permission_grants").insert(
    grants.map((g) => ({
      user_id: userId,
      permission_key: g.permission_key,
      granted: g.granted,
    }))
  );
  if (error) throwDbError(error, "setUserPermissionGrants");
}

export async function getPermissionsForRole(
  role: UserRole
): Promise<PermissionKey[]> {
  const orgId = await getOrgId();
  const rows = await getRolePermissions(orgId);
  return rows.filter((r) => r.role === role).map((r) => r.permission_key as PermissionKey);
}

export async function getEffectivePermissions(user: {
  id: string;
  role: UserRole;
}): Promise<Set<PermissionKey>> {
  const all = await listPermissions();
  if (user.role === "owner") {
    return new Set(all.map((p) => p.key as PermissionKey));
  }
  const rolePerms = await getPermissionsForRole(user.role);
  const set = new Set(rolePerms);
  const grants = await getUserPermissionGrants(user.id);
  for (const g of grants) {
    const key = g.permission_key as PermissionKey;
    if (g.granted) set.add(key);
    else set.delete(key);
  }
  return set;
}

export function permissionAllowsPath(
  pathname: string,
  permissions: Set<PermissionKey>
): boolean {
  const match = Object.entries(PATH_PERMISSIONS).find(
    ([path]) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`))
  );
  if (!match) return true;
  const required = match[1];
  if (!required) return true;
  if (Array.isArray(required)) return required.some((k) => permissions.has(k));
  return permissions.has(required);
}
