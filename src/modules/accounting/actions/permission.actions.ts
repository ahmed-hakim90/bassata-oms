"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requirePermissionOrRole } from "@/lib/auth/guards";
import {
  getRolePermissionMatrix,
  listPermissions,
  updateRolePermissions,
  updateUserPermissionGrants,
} from "@/modules/accounting/services/permission.service";
import type { PermissionKey } from "@/lib/types";
import type { UserRole } from "@/lib/constants";

export async function getPermissionsData() {
  await requirePermissionOrRole("user_manage", ["owner"]);
  const [permissions, matrix] = await Promise.all([
    listPermissions(),
    getRolePermissionMatrix(),
  ]);
  return { permissions, matrix };
}

export async function updateRolePermissionsAction(
  role: UserRole,
  permissionKeys: PermissionKey[]
) {
  const user = await requirePermissionOrRole("user_manage", ["owner"]);
  await updateRolePermissions(role, permissionKeys, user.id);
  revalidatePath("/users");
  revalidatePath("/settings");
}

export async function updateUserPermissionGrantsAction(
  targetUserId: string,
  grants: { permission_key: PermissionKey; granted: boolean }[]
) {
  const user = await requirePermissionOrRole("user_manage", ["owner"]);
  await updateUserPermissionGrants(targetUserId, grants, user.id);
  revalidatePath("/users");
  revalidatePath("/settings");
}

export async function checkPermissionAction(key: PermissionKey) {
  const user = await requireAuth();
  if (user.role === "owner") return true;
  const { userHasPermission } = await import(
    "@/modules/accounting/services/permission.service"
  );
  return userHasPermission(user.id, user.role, key);
}
