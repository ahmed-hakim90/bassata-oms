"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppUser, Permission } from "@/lib/types";
import type { PermissionKey } from "@/lib/constants";
import { updateUserPermissionGrantsAction } from "@/modules/accounting/actions/permission.actions";

interface UserPermissionOverridesProps {
  users: AppUser[];
  permissions: Permission[];
  initialGrants: Record<string, { permission_key: string; granted: boolean }[]>;
}

export function UserPermissionOverrides({
  users,
  permissions,
  initialGrants,
}: UserPermissionOverridesProps) {
  const [pending, startTransition] = useTransition();
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const userGrants = initialGrants[userId] ?? [];
  const grantMap = new Map(userGrants.map((g) => [g.permission_key, g.granted]));

  function isChecked(key: PermissionKey): boolean {
    if (key in overrides) return overrides[key];
    return grantMap.get(key) ?? false;
  }

  function toggle(key: PermissionKey, checked: boolean) {
    setOverrides((o) => ({ ...o, [key]: checked }));
  }

  function save() {
    if (!userId) return;
    const grants = Object.entries(overrides).map(([permission_key, granted]) => ({
      permission_key: permission_key as PermissionKey,
      granted,
    }));
    startTransition(async () => {
      try {
        await updateUserPermissionGrantsAction(userId, grants);
        toast.success("User overrides saved");
        setOverrides({});
      } catch {
        toast.error("Could not save overrides");
      }
    });
  }

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.group_name] ??= []).push(p);
    return acc;
  }, {});

  return (
    <OperationalCard title="User permission overrides" description="Grant or deny specific permissions per user (owner only)">
      <div className="mb-4 max-w-sm">
        <Select value={userId} onValueChange={(v) => { setUserId(v ?? ""); setOverrides({}); }}>
          <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
          <SelectContent>
            {users.filter((u) => u.role !== "owner").map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-4">
        {Object.entries(grouped).map(([group, perms]) => (
          <div key={group}>
            <p className="mb-2 text-sm font-medium capitalize">{group}</p>
            <ul className="space-y-2">
              {perms.map((p) => (
                <li key={p.key} className="flex items-center gap-2">
                  <Checkbox
                    checked={isChecked(p.key as PermissionKey)}
                    onCheckedChange={(v) => toggle(p.key as PermissionKey, v === true)}
                  />
                  <span className="text-sm">{p.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Button className="mt-4 rounded-xl" disabled={pending || Object.keys(overrides).length === 0} onClick={save}>
        Save overrides
      </Button>
    </OperationalCard>
  );
}
