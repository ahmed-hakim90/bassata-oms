"use client";

import { UsersPage } from "@/modules/system/components/users-page";
import type { AppUser, Store, Permission, PermissionKey } from "@/lib/types";
import type { UserRole } from "@/lib/constants";

interface UsersSettingsTabProps {
  users: AppUser[];
  stores: Store[];
  devices: { id: string; store_id: string; name: string; is_active: boolean; last_seen_at: string | null }[];
  userDeviceIds: Record<string, string[]>;
  permissionsData: {
    permissions: Permission[];
    matrix: Record<UserRole, PermissionKey[]>;
    userGrants: Record<string, { permission_key: string; granted: boolean }[]>;
  } | null;
}

export function UsersSettingsTab(props: UsersSettingsTabProps) {
  return <UsersPage {...props} embedded />;
}
