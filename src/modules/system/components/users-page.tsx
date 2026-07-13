"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { ConfirmActionDialog } from "@/components/SweetFlow/confirm-action-dialog";
import type { AppUser, Store, Permission, PermissionKey } from "@/lib/types";
import type { UserRole } from "@/lib/constants";
import { ROLE_LABELS } from "@/lib/constants";
import { PermissionsMatrix } from "@/modules/accounting/components/permissions-matrix";
import { UserPermissionOverrides } from "@/modules/accounting/components/user-permission-overrides";
import {
  createUserAction,
  deactivateUserAction,
  deleteUserPermanentlyAction,
  resetUserPinAction,
  resetUserPasswordAction,
  updateUserAction,
} from "@/modules/system/actions/system.actions";

function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role];
}

type UserEditState = {
  name: string;
  email: string;
  role: AppUser["role"];
  storeIds: string[];
  deviceIds: string[];
  restrictDevices: boolean;
  isActive: boolean;
};

interface UsersPageProps {
  users: AppUser[];
  stores: Store[];
  devices: { id: string; store_id: string; name: string }[];
  userDeviceIds: Record<string, string[]>;
  actorRole?: UserRole;
  permissionsData: {
    permissions: Permission[];
    matrix: Record<UserRole, PermissionKey[]>;
    userGrants: Record<string, { permission_key: string; granted: boolean }[]>;
  } | null;
  embedded?: boolean;
}

export function UsersPage({
  users,
  stores,
  devices,
  userDeviceIds,
  actorRole = "owner",
  permissionsData,
  embedded,
}: UsersPageProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "cashier" as AppUser["role"],
    storeIds: [stores[0]?.id ?? ""].filter(Boolean),
    deviceIds: [] as string[],
    restrictDevices: false,
    pin: "",
    password: "",
  });
  const [edits, setEdits] = useState<Record<string, UserEditState>>(
    Object.fromEntries(
      users.map((u) => [
        u.id,
        {
          name: u.name,
          email: u.email,
          role: u.role,
          storeIds: u.store_ids,
          deviceIds: userDeviceIds[u.id] ?? [],
          restrictDevices: (userDeviceIds[u.id]?.length ?? 0) > 0,
          isActive: u.is_active,
        },
      ])
    )
  );

  const editingUser = useMemo(
    () => users.find((u) => u.id === editingUserId) ?? null,
    [users, editingUserId]
  );
  const editing = editingUserId ? edits[editingUserId] : null;

  const createRoleOptions = useMemo(
    () =>
      (["owner", "manager", "cashier", "inventory"] as const).filter(
        (role) => actorRole === "owner" || role !== "owner"
      ),
    [actorRole]
  );
  const editRoleOptions = useMemo(() => {
    const roles = (["owner", "manager", "cashier", "inventory"] as const).filter(
      (role) => actorRole === "owner" || role !== "owner" || editing?.role === "owner"
    );
    return roles;
  }, [actorRole, editing?.role]);

  const canCreate =
    form.name.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.password.length >= 8 &&
    (form.role !== "cashier" || /^[0-9]{4,8}$/.test(form.pin));

  const openEditor = (user: AppUser) => {
    setEditingUserId(user.id);
    setPinValue("");
    setPasswordValue("");
    setEdits((prev) => ({
      ...prev,
      [user.id]:
        prev[user.id] ??
        ({
          name: user.name,
          email: user.email,
          role: user.role,
          storeIds: user.store_ids,
          deviceIds: userDeviceIds[user.id] ?? [],
          restrictDevices: (userDeviceIds[user.id]?.length ?? 0) > 0,
          isActive: user.is_active,
        } satisfies UserEditState),
    }));
  };

  const patchEdit = (id: string, patch: Partial<UserEditState>) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id]!, ...patch },
    }));
  };

  const saveUser = (id: string) => {
    const current = edits[id];
    if (!current) return;
    startTransition(async () => {
      const result = await updateUserAction(id, {
        ...current,
        deviceIds: current.restrictDevices ? current.deviceIds : [],
      });
      if (result.success) {
        toast.success("تم تحديث المستخدم");
        setEditingUserId(null);
        return;
      }
      toast.error(result.error ?? "تعذر تحديث المستخدم");
    });
  };

  const create = () => {
    if (!canCreate) {
      toast.error("أكمل البيانات المطلوبة. كلمة المرور 8 أحرف أو أكثر.");
      return;
    }

    startTransition(async () => {
      const result = await createUserAction({
        ...form,
        deviceIds: form.restrictDevices ? form.deviceIds : undefined,
      });
      if (result.success) {
        toast.success("تم إنشاء المستخدم");
        setForm({
          name: "",
          email: "",
          role: "cashier",
          storeIds: [stores[0]?.id ?? ""].filter(Boolean),
          deviceIds: [],
          restrictDevices: false,
          pin: "",
          password: "",
        });
        return;
      }
      toast.error(result.error ?? "فشل إنشاء المستخدم");
    });
  };

  return (
    <>
      {embedded ? null : (
        <PageHeader
          title="المستخدمون والأدوار"
          description="إدارة الفريق من قائمة واحدة — عدّل كل شخص من مكانه"
        />
      )}

      <Tabs defaultValue="team" className="min-w-0 space-y-6">
        <div className="-mx-1 overflow-x-auto px-1 pb-1 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex h-auto min-w-max flex-nowrap justify-start gap-1 sm:min-w-0 sm:flex-wrap">
            <TabsTrigger value="team">الفريق</TabsTrigger>
            <TabsTrigger value="create">إنشاء مستخدم</TabsTrigger>
            {permissionsData ? <TabsTrigger value="permissions">الصلاحيات</TabsTrigger> : null}
          </TabsList>
        </div>

        <TabsContent value="team">
          {users.length === 0 ? (
            <EmptyStateBlock
              title="لا يوجد مستخدمون"
              description="أنشئ أول مستخدم للفريق من تبويب الإنشاء."
            />
          ) : (
            <div className="grid gap-3">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 text-card-foreground sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Shield className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{u.name}</p>
                      <p className="break-all text-sm text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill label={roleLabel(u.role as UserRole)} variant="info" />
                    <StatusPill
                      label={u.is_active ? "نشط" : "غير نشط"}
                      variant={u.is_active ? "success" : "draft"}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-10"
                      onClick={() => openEditor(u)}
                    >
                      <Pencil className="size-4" aria-hidden />
                      تعديل
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="create">
          <OperationalCard title="إنشاء مستخدم">
            <div className="grid max-w-lg gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">الاسم</Label>
                <Input
                  id="create-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-email">البريد الإلكتروني</Label>
                <Input
                  id="create-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-password">كلمة مرور مؤقتة</Label>
                <PasswordInput
                  id="create-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  minLength={8}
                />
                {form.password.length > 0 && form.password.length < 8 ? (
                  <p className="text-sm text-destructive">
                    كلمة المرور يجب أن تكون 8 أحرف أو أكثر.
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-role">الدور</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) =>
                    setForm({ ...form, role: (v ?? "cashier") as AppUser["role"] })
                  }
                >
                  <SelectTrigger id="create-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {createRoleOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.role === "cashier" && (
                <div className="space-y-2">
                  <Label htmlFor="create-pin">PIN (4–8 أرقام)</Label>
                  <Input
                    id="create-pin"
                    value={form.pin}
                    onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
                    maxLength={8}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>صلاحيات الفروع</Label>
                <div className="grid gap-2 rounded-xl border border-border/60 p-3">
                  {stores.map((store) => (
                    <label key={store.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.storeIds.includes(store.id)}
                        onCheckedChange={(v) => {
                          const next =
                            v === true
                              ? [...new Set([...form.storeIds, store.id])]
                              : form.storeIds.filter((id) => id !== store.id);
                          setForm({ ...form, storeIds: next });
                        }}
                      />
                      {store.name}
                    </label>
                  ))}
                </div>
              </div>
              {form.role === "cashier" && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={form.restrictDevices}
                      onCheckedChange={(v) =>
                        setForm({
                          ...form,
                          restrictDevices: v === true,
                          deviceIds: v === true ? form.deviceIds : [],
                        })
                      }
                    />
                    تقييد المستخدم على أجهزة كاشير محددة
                  </label>
                  {form.restrictDevices ? (
                    <div className="grid gap-2 rounded-xl border border-border/60 p-3">
                      {devices
                        .filter((d) => form.storeIds.includes(d.store_id))
                        .map((device) => (
                          <label key={device.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={form.deviceIds.includes(device.id)}
                              onCheckedChange={(v) => {
                                const next =
                                  v === true
                                    ? [...new Set([...form.deviceIds, device.id])]
                                    : form.deviceIds.filter((id) => id !== device.id);
                                setForm({ ...form, deviceIds: next });
                              }}
                            />
                            {device.name}
                          </label>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      تركها فارغة يعني السماح بكل الأجهزة داخل الفروع المسموحة.
                    </p>
                  )}
                </div>
              )}
              <Button onClick={create} disabled={pending || !canCreate} className="min-h-10">
                إنشاء مستخدم
              </Button>
            </div>
          </OperationalCard>
        </TabsContent>

        {permissionsData ? (
          <TabsContent value="permissions" className="space-y-6">
            <PermissionsMatrix
              permissions={permissionsData.permissions}
              matrix={permissionsData.matrix}
            />
            <UserPermissionOverrides
              users={users}
              permissions={permissionsData.permissions}
              initialGrants={permissionsData.userGrants}
            />
          </TabsContent>
        ) : null}
      </Tabs>

      <Sheet open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUserId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {editingUser && editing ? (
            <>
              <SheetHeader>
                <SheetTitle>تعديل {editingUser.name}</SheetTitle>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">الاسم</Label>
                  <Input
                    id="edit-name"
                    value={editing.name}
                    onChange={(e) => patchEdit(editingUser.id, { name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">البريد الإلكتروني</Label>
                  <Input
                    id="edit-email"
                    value={editing.email}
                    onChange={(e) => patchEdit(editingUser.id, { email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">الدور</Label>
                  <Select
                    value={editing.role}
                    onValueChange={(role) =>
                      patchEdit(editingUser.id, {
                        role: (role ?? editingUser.role) as AppUser["role"],
                      })
                    }
                  >
                    <SelectTrigger id="edit-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {editRoleOptions.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={editing.isActive}
                    onCheckedChange={(v) =>
                      patchEdit(editingUser.id, { isActive: v === true })
                    }
                  />
                  نشط
                </label>

                <div className="space-y-2">
                  <Label>صلاحيات الفروع</Label>
                  <div className="grid gap-2 rounded-xl border border-border/60 p-3">
                    {stores.map((store) => (
                      <label key={store.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={editing.storeIds.includes(store.id)}
                          onCheckedChange={(v) => {
                            const next =
                              v === true
                                ? [...new Set([...editing.storeIds, store.id])]
                                : editing.storeIds.filter((id) => id !== store.id);
                            patchEdit(editingUser.id, { storeIds: next });
                          }}
                        />
                        {store.name}
                      </label>
                    ))}
                  </div>
                </div>

                {editing.role === "cashier" ? (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={editing.restrictDevices}
                        onCheckedChange={(v) =>
                          patchEdit(editingUser.id, {
                            restrictDevices: v === true,
                            deviceIds: v === true ? editing.deviceIds : [],
                          })
                        }
                      />
                      تقييد على أجهزة محددة
                    </label>
                    {editing.restrictDevices ? (
                      <div className="grid gap-2 rounded-xl border border-border/60 p-3">
                        {devices
                          .filter((d) => editing.storeIds.includes(d.store_id))
                          .map((device) => (
                            <label key={device.id} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={editing.deviceIds.includes(device.id)}
                                onCheckedChange={(v) => {
                                  const next =
                                    v === true
                                      ? [...new Set([...editing.deviceIds, device.id])]
                                      : editing.deviceIds.filter((id) => id !== device.id);
                                  patchEdit(editingUser.id, { deviceIds: next });
                                }}
                              />
                              {device.name}
                            </label>
                          ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {editing.role === "cashier" ? (
                  <div className="space-y-2 rounded-xl border border-border/60 p-3">
                    <Label htmlFor="edit-pin">إعادة ضبط PIN</Label>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        id="edit-pin"
                        placeholder="4-8 أرقام"
                        maxLength={8}
                        inputMode="numeric"
                        autoComplete="off"
                        className="max-w-[10rem]"
                        value={pinValue}
                        onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={pending || !/^[0-9]{4,8}$/.test(pinValue)}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await resetUserPinAction(editingUser.id, pinValue);
                            if (result.success) {
                              setPinValue("");
                              toast.success("تمت إعادة ضبط PIN");
                              return;
                            }
                            toast.error(result.error ?? "تعذرت إعادة ضبط PIN");
                          });
                        }}
                      >
                        ضبط PIN
                      </Button>
                    </div>
                  </div>
                ) : null}

                {editingUser.auth_user_id ? (
                  <div className="space-y-2 rounded-xl border border-border/60 p-3">
                    <Label htmlFor="edit-password">إعادة ضبط كلمة المرور</Label>
                    <div className="flex flex-wrap gap-2">
                      <div className="w-full max-w-[14rem]">
                        <PasswordInput
                          id="edit-password"
                          placeholder="8 أحرف أو أكثر"
                          value={passwordValue}
                          onChange={(e) => setPasswordValue(e.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={pending || passwordValue.length < 8}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await resetUserPasswordAction(
                              editingUser.id,
                              passwordValue
                            );
                            if (result.success) {
                              setPasswordValue("");
                              toast.success("تمت إعادة ضبط كلمة المرور");
                              return;
                            }
                            toast.error(result.error ?? "تعذرت إعادة ضبط كلمة المرور");
                          });
                        }}
                      >
                        ضبط كلمة المرور
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
              <SheetFooter className="gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => saveUser(editingUser.id)}
                >
                  حفظ التغييرات
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!editingUser.is_active || pending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await deactivateUserAction(editingUser.id);
                      if (result.success) {
                        toast.success("تم تعطيل المستخدم");
                        setEditingUserId(null);
                        router.refresh();
                        return;
                      }
                      toast.error(result.error ?? "تعذر تعطيل المستخدم");
                    });
                  }}
                >
                  تعطيل
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => setUserToDelete(editingUser)}
                >
                  حذف نهائي
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmActionDialog
        open={userToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setUserToDelete(null);
        }}
        title="حذف المستخدم نهائيًا؟"
        description={
          userToDelete
            ? `هيتشال ${userToDelete.name} (${userToDelete.email}) من الداتابيز وحساب الدخول. لو عنده طلبات أو جلسات أو مصروفات أو حركات مخزون، العملية هتترفض وعليك تستخدم التعطيل.`
            : ""
        }
        confirmLabel="حذف نهائي"
        destructive
        onConfirm={async () => {
          if (!userToDelete) return;
          const result = await deleteUserPermanentlyAction(userToDelete.id);
          if (!result.success) {
            toast.error(result.error ?? "تعذر حذف المستخدم نهائيًا");
            throw new Error(result.error ?? "delete failed");
          }
          toast.success("تم حذف المستخدم نهائيًا");
          setUserToDelete(null);
          setEditingUserId(null);
          router.refresh();
        }}
      />
    </>
  );
}
