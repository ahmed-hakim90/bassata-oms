"use client";

import { useState, useTransition } from "react";
import { Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import type { AppUser, Store, Permission, PermissionKey } from "@/lib/types";
import type { UserRole } from "@/lib/constants";
import { ROLE_LABELS } from "@/lib/constants";
import { PermissionsMatrix } from "@/modules/accounting/components/permissions-matrix";
import { UserPermissionOverrides } from "@/modules/accounting/components/user-permission-overrides";
import {
  createUserAction,
  deactivateUserAction,
  resetUserPinAction,
  resetUserPasswordAction,
  updateUserAction,
} from "@/modules/system/actions/system.actions";

function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role];
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

interface UsersPageProps {
  users: AppUser[];
  stores: Store[];
  devices: { id: string; store_id: string; name: string }[];
  userDeviceIds: Record<string, string[]>;
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
  permissionsData,
  embedded,
}: UsersPageProps) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "cashier" as AppUser["role"],
    storeIds: [stores[0]?.id ?? ""],
    deviceIds: [] as string[],
    restrictDevices: false,
    pin: "1234",
    password: "",
  });
  const [pinReset, setPinReset] = useState<Record<string, string>>({});
  const [passwordReset, setPasswordReset] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState(
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

  const saveUser = (id: string) => {
    startTransition(async () => {
      try {
        await updateUserAction(id, {
          ...edits[id],
          deviceIds: edits[id]?.restrictDevices ? edits[id]?.deviceIds : [],
        });
        toast.success("تم تحديث المستخدم");
      } catch {
        toast.error("تعذر تحديث المستخدم");
      }
    });
  };

  const create = () => {
    startTransition(async () => {
      try {
        await createUserAction({
          ...form,
          deviceIds: form.restrictDevices ? form.deviceIds : undefined,
        });
        toast.success("تم إنشاء المستخدم");
      } catch (error) {
        toast.error(errorMessage(error, "فشل إنشاء المستخدم"));
      }
    });
  };

  return (
    <>
      {embedded ? null : (
        <PageHeader
          title="المستخدمون والأدوار"
          description="إدارة صلاحيات الفريق وأرقام PIN للكاشير"
        />
      )}

      <Tabs defaultValue="team" className="min-w-0 space-y-6">
        <div className="-mx-1 overflow-x-auto px-1 pb-1 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex h-auto min-w-max flex-nowrap justify-start gap-1 sm:min-w-0 sm:flex-wrap">
            <TabsTrigger value="team">الفريق</TabsTrigger>
            <TabsTrigger value="create">إنشاء مستخدم</TabsTrigger>
            <TabsTrigger value="stores">صلاحيات الفروع</TabsTrigger>
            <TabsTrigger value="pin">إعادة ضبط PIN</TabsTrigger>
            <TabsTrigger value="passwords">إعادة ضبط كلمة المرور</TabsTrigger>
            <TabsTrigger value="roles">الدور والحالة</TabsTrigger>
            {permissionsData ? <TabsTrigger value="permissions">الصلاحيات</TabsTrigger> : null}
          </TabsList>
        </div>

        <TabsContent value="team">
          <div className="grid gap-3">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-card-foreground sm:flex-row sm:items-center sm:justify-between"
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
                <div className="flex flex-wrap gap-2">
                  <StatusPill label={roleLabel(u.role as UserRole)} variant="info" />
                  <StatusPill
                    label={u.is_active ? "نشط" : "غير نشط"}
                    variant={u.is_active ? "success" : "draft"}
                  />
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="create">
          <OperationalCard title="إنشاء مستخدم">
            <div className="grid max-w-lg gap-4">
              <div className="space-y-2">
                <Label>الاسم</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>كلمة مرور مؤقتة</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label>الدور</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) =>
                    setForm({ ...form, role: (v ?? "cashier") as AppUser["role"] })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["owner", "manager", "cashier", "inventory"] as const).map(
                      (r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              {form.role === "cashier" && (
                <div className="space-y-2">
                  <Label>PIN</Label>
                  <Input
                    value={form.pin}
                    onChange={(e) => setForm({ ...form, pin: e.target.value })}
                    maxLength={6}
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
              <Button onClick={create} disabled={pending}>
                إنشاء مستخدم
              </Button>
            </div>
          </OperationalCard>
        </TabsContent>

        <TabsContent value="stores">
          <OperationalCard title="صلاحيات الفروع حسب المستخدم">
            <div className="space-y-6">
              {users.map((u) => (
                <div key={u.id} className="border-b border-border/60 pb-4 last:border-0">
                  <p className="mb-2 font-medium">{u.name}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {stores.map((store) => (
                      <label key={store.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={(edits[u.id]?.storeIds ?? u.store_ids).includes(store.id)}
                          onCheckedChange={(v) => {
                            const current = edits[u.id]?.storeIds ?? u.store_ids;
                            const next =
                              v === true
                                ? [...new Set([...current, store.id])]
                                : current.filter((id) => id !== store.id);
                            setEdits({
                              ...edits,
                              [u.id]: { ...edits[u.id], storeIds: next },
                            });
                          }}
                        />
                        {store.name}
                      </label>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    disabled={pending}
                    onClick={() => saveUser(u.id)}
                  >
                    حفظ صلاحيات الفروع
                  </Button>
                </div>
              ))}
            </div>
          </OperationalCard>
        </TabsContent>

        <TabsContent value="pin">
          <OperationalCard title="إعادة ضبط PIN للكاشير">
            <div className="space-y-4">
              {users.filter((u) => u.role === "cashier").length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد حسابات كاشير.</p>
              ) : (
                users
                  .filter((u) => u.role === "cashier")
                  .map((u) => (
                    <div key={u.id} className="flex max-w-md flex-wrap items-center gap-2">
                      <span className="min-w-[8rem] text-sm font-medium">{u.name}</span>
                      <Input
                        placeholder="PIN جديد (4-8 أرقام)"
                        maxLength={8}
                        className="max-w-[10rem]"
                        value={pinReset[u.id] ?? ""}
                        onChange={(e) =>
                          setPinReset({ ...pinReset, [u.id]: e.target.value })
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={pending || !(pinReset[u.id]?.length >= 4)}
                        onClick={() => {
                          startTransition(async () => {
                            try {
                              await resetUserPinAction(u.id, pinReset[u.id]);
                              setPinReset({ ...pinReset, [u.id]: "" });
                              toast.success("تمت إعادة ضبط PIN");
                            } catch {
                              toast.error("تعذرت إعادة ضبط PIN");
                            }
                          });
                        }}
                      >
                        إعادة ضبط PIN
                      </Button>
                    </div>
                  ))
              )}
            </div>
          </OperationalCard>
        </TabsContent>

        <TabsContent value="passwords">
          <OperationalCard title="إعادة ضبط كلمة مرور الدخول">
            <p className="mb-4 text-sm text-muted-foreground">
              يعيّن كلمة مرور جديدة لدخول المستخدم بالبريد الإلكتروني. شاركها معه بطريقة آمنة.
            </p>
            <div className="space-y-4">
              {users.filter((u) => u.auth_user_id).length === 0 ? (
                <p className="text-sm text-muted-foreground">لا يوجد مستخدمون لديهم حسابات دخول.</p>
              ) : (
                users
                  .filter((u) => u.auth_user_id)
                  .map((u) => (
                    <div key={u.id} className="flex max-w-lg flex-wrap items-center gap-2">
                      <span className="min-w-[8rem] text-sm font-medium">{u.name}</span>
                      <Input
                        type="password"
                        placeholder="كلمة مرور جديدة (8 أحرف أو أكثر)"
                        className="max-w-[14rem]"
                        value={passwordReset[u.id] ?? ""}
                        onChange={(e) =>
                          setPasswordReset({ ...passwordReset, [u.id]: e.target.value })
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={pending || (passwordReset[u.id]?.length ?? 0) < 8}
                        onClick={() => {
                          startTransition(async () => {
                            try {
                              await resetUserPasswordAction(u.id, passwordReset[u.id]!);
                              setPasswordReset({ ...passwordReset, [u.id]: "" });
                              toast.success("تمت إعادة ضبط كلمة المرور");
                            } catch {
                              toast.error("تعذرت إعادة ضبط كلمة المرور");
                            }
                          });
                        }}
                      >
                        إعادة ضبط كلمة المرور
                      </Button>
                    </div>
                  ))
              )}
            </div>
          </OperationalCard>
        </TabsContent>

        <TabsContent value="roles">
          <OperationalCard title="الدور والحالة">
            <div className="space-y-6">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="grid gap-3 border-b border-border/60 pb-4 last:border-0 md:grid-cols-[1fr_1fr_1fr_auto]"
                >
                  <p className="font-medium md:col-span-4 md:mb-1">{u.name}</p>
                  <Input
                    value={edits[u.id]?.name ?? u.name}
                    onChange={(e) =>
                      setEdits({
                        ...edits,
                        [u.id]: { ...edits[u.id], name: e.target.value },
                      })
                    }
                  />
                  <Input
                    value={edits[u.id]?.email ?? u.email}
                    onChange={(e) =>
                      setEdits({
                        ...edits,
                        [u.id]: { ...edits[u.id], email: e.target.value },
                      })
                    }
                  />
                  <Select
                    value={edits[u.id]?.role ?? u.role}
                    onValueChange={(role) =>
                      setEdits({
                        ...edits,
                        [u.id]: {
                          ...edits[u.id],
                          role: (role ?? u.role) as AppUser["role"],
                        },
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["owner", "manager", "cashier", "inventory"] as const).map(
                        (role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={edits[u.id]?.isActive ?? u.is_active}
                        onCheckedChange={(v) =>
                          setEdits({
                            ...edits,
                            [u.id]: { ...edits[u.id], isActive: v === true },
                          })
                        }
                      />
                      نشط
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => saveUser(u.id)}
                    >
                      حفظ
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!u.is_active || pending}
                      onClick={() => {
                        startTransition(async () => {
                          try {
                            await deactivateUserAction(u.id);
                            toast.success("تم تعطيل المستخدم");
                          } catch {
                            toast.error("تعذر تعطيل المستخدم");
                          }
                        });
                      }}
                    >
                      تعطيل
                    </Button>
                  </div>
                </div>
              ))}
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
    </>
  );
}
