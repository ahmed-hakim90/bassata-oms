import * as permissionRepo from "@/lib/repositories/permission.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { Permission, PermissionKey } from "@/lib/types";
import type { UserRole } from "@/lib/constants";

export async function listPermissions(): Promise<Permission[]> {
  return permissionRepo.listPermissions();
}

export async function getRolePermissionMatrix(): Promise<
  Record<UserRole, PermissionKey[]>
> {
  const rows = await permissionRepo.getRolePermissions();
  const matrix: Record<UserRole, PermissionKey[]> = {
    owner: [],
    manager: [],
    cashier: [],
    inventory: [],
    viewer: [],
  };
  for (const row of rows) {
    matrix[row.role].push(row.permission_key as PermissionKey);
  }
  return matrix;
}

export async function updateRolePermissions(
  role: UserRole,
  permissionKeys: PermissionKey[],
  userId: string
): Promise<void> {
  await permissionRepo.setRolePermissions(role, permissionKeys);
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    userId,
    action: "role_permissions.updated",
    entityType: "role_permissions",
    entityId: role,
    metadata: { permissionKeys },
  });
}

export async function updateUserPermissionGrants(
  targetUserId: string,
  grants: { permission_key: PermissionKey; granted: boolean }[],
  userId: string
): Promise<void> {
  await permissionRepo.setUserPermissionGrants(targetUserId, grants);
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    userId,
    action: "role_permissions.updated",
    entityType: "user_permission_grants",
    entityId: targetUserId,
    metadata: { grants },
  });
}

export async function userHasPermission(
  userId: string,
  role: UserRole,
  key: PermissionKey
): Promise<boolean> {
  if (role === "owner") return true;
  const grants = await permissionRepo.getUserPermissionGrants(userId);
  const override = grants.find((g) => g.permission_key === key);
  if (override) return override.granted;
  const rolePerms = await permissionRepo.getPermissionsForRole(role);
  return rolePerms.includes(key);
}
