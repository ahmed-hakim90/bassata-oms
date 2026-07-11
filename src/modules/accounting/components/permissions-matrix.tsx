"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { ROLE_LABELS, ROLES, type UserRole } from "@/lib/constants";
import type { Permission, PermissionKey } from "@/lib/types";
import { updateRolePermissionsAction } from "@/modules/accounting/actions/permission.actions";

interface PermissionsMatrixProps {
  permissions: Permission[];
  matrix: Record<UserRole, PermissionKey[]>;
}

export function PermissionsMatrix({ permissions, matrix: initialMatrix }: PermissionsMatrixProps) {
  const [pending, startTransition] = useTransition();
  const [matrix, setMatrix] = useState(initialMatrix);
  const [selectedRole, setSelectedRole] = useState<UserRole>("manager");

  const rolePerms = new Set(matrix[selectedRole] ?? []);

  function togglePermission(key: PermissionKey) {
    const next = new Set(rolePerms);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setMatrix({ ...matrix, [selectedRole]: [...next] });
  }

  function save() {
    startTransition(async () => {
      try {
        await updateRolePermissionsAction(selectedRole, matrix[selectedRole] ?? []);
        toast.success("تم تحديث الصلاحيات");
      } catch {
        toast.error("تعذر حفظ الصلاحيات");
      }
    });
  }

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.group_name] ??= []).push(p);
    return acc;
  }, {});

  return (
    <OperationalCard
      title="صلاحيات الأدوار"
      description="للمالك فقط — خصّص الوصول حسب الدور"
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {ROLES.filter((r) => r !== "owner").map((role) => (
          <Button
            key={role}
            size="sm"
            variant={selectedRole === role ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setSelectedRole(role)}
          >
            {ROLE_LABELS[role]}
          </Button>
        ))}
      </div>
      <div className="space-y-6">
        {Object.entries(grouped).map(([group, perms]) => (
          <div key={group}>
            <p className="mb-2 text-sm font-medium">{group}</p>
            <ul className="space-y-2">
              {perms.map((p) => (
                <li key={p.key}>
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={rolePerms.has(p.key as PermissionKey)}
                      onCheckedChange={() => togglePermission(p.key as PermissionKey)}
                    />
                    <div>
                      <p className="text-sm font-medium">{p.label}</p>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Button className="mt-6 rounded-xl" disabled={pending} onClick={save}>
        حفظ صلاحيات {ROLE_LABELS[selectedRole]}
      </Button>
    </OperationalCard>
  );
}
