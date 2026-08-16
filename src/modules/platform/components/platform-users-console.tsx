"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import {
  Ban,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  LogOut,
  Plus,
  Search,
  Shield,
  UserRoundSearch,
} from "lucide-react";
import { CompactAction } from "@/components/Velora/compact-actions";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { StatusPill } from "@/components/Velora/status-pill";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { ConfirmActionDialog } from "@/components/Velora/confirm-action-dialog";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { ResponsiveListLayout } from "@/components/Velora/responsive-list-layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS, ROLES, type UserRole } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { PlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import type {
  PlatformOrgOption,
  PlatformStoreOption,
  PlatformTenantUser,
} from "@/modules/platform/services/platform-users.service";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import {
  createPlatformTenantUserAction,
  createTenantImpersonationLinkAction,
  exportPlatformUsersExcelAction,
  listPlatformStoresForOrgAction,
  resetPlatformTenantUserPasswordAction,
  setPlatformAdminActiveAction,
  setPlatformTenantUserActiveAction,
  setPlatformTenantUserRoleAction,
  signOutPlatformTenantUserAction,
  upsertPlatformAdminAction,
} from "@/modules/platform/actions/platform.actions";

interface PlatformUsersConsoleProps {
  users: PlatformTenantUser[];
  orgs: PlatformOrgOption[];
  platformAdmins: PlatformAdmin[];
}

export function PlatformUsersConsole({
  users,
  orgs,
  platformAdmins,
}: PlatformUsersConsoleProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [passwordUser, setPasswordUser] = useState<PlatformTenantUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deactivateUser, setDeactivateUser] = useState<PlatformTenantUser | null>(null);

  const [createOrgId, setCreateOrgId] = useState(orgs[0]?.id ?? "");
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createRole, setCreateRole] = useState<UserRole>("cashier");
  const [createPassword, setCreatePassword] = useState("");
  const [createStoreIds, setCreateStoreIds] = useState<string[]>([]);
  const [stores, setStores] = useState<PlatformStoreOption[]>([]);

  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [impersonateLink, setImpersonateLink] = useState<string | null>(null);
  const [impersonateEmail, setImpersonateEmail] = useState<string | null>(null);

  useEffect(() => {
    if (createOrgId) loadStores(createOrgId);
    // Initial store load for the default org only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((user) => {
      if (orgFilter !== "all" && user.org_id !== orgFilter) return false;
      if (!q) return true;
      return (
        user.email.toLowerCase().includes(q) ||
        user.name.toLowerCase().includes(q) ||
        user.org_name.toLowerCase().includes(q)
      );
    });
  }, [users, search, orgFilter]);

  function refresh() {
    router.refresh();
  }

  function loadStores(orgId: string) {
    setCreateOrgId(orgId);
    setCreateStoreIds([]);
    if (!orgId) {
      setStores([]);
      return;
    }
    startTransition(async () => {
      const result = await listPlatformStoresForOrgAction(orgId);
      if (!result.ok) {
        toast.error(result.error);
        setStores([]);
        return;
      }
      setStores(result.data);
      if (result.data[0]) setCreateStoreIds([result.data[0].id]);
    });
  }

  function onCreateUser(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createPlatformTenantUserAction({
        orgId: createOrgId,
        name: createName,
        email: createEmail,
        role: createRole,
        storeIds: createStoreIds,
        password: createPassword,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("تم إنشاء المستخدم");
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      setCreateRole("cashier");
      refresh();
    });
  }

  function onAddPlatformAdmin(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await upsertPlatformAdminAction({
        email: adminEmail,
        name: adminName || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("تم حفظ مشرف المنصة");
      setAdminEmail("");
      setAdminName("");
      refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="مستخدمو المنصة"
        action={
          <CompactAction
            label="تصدير Excel"
            icon={Download}
            disabled={pending || users.length === 0}
            onClick={() => {
              startTransition(async () => {
                const result = await exportPlatformUsersExcelAction();
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                downloadBase64Excel(result.data.base64, result.data.fileName);
                toast.success("تم تنزيل تقرير المستخدمين");
              });
            }}
          />
        }
      />

      <OperationalCard
        title="كل المستخدمين"
      >
        <div className="mb-[var(--mds-space-4)] flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="relative max-w-md flex-1">
            <Label htmlFor="user-search" className="sr-only">
              بحث
            </Label>
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="user-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="اسم، إيميل، أو شركة…"
              className="ps-9"
              autoComplete="off"
            />
          </div>
          <div className="w-full sm:w-56">
            <Label htmlFor="org-filter" className="mb-1.5 block text-xs">
              الشركة
            </Label>
            <Select
              value={orgFilter}
              onValueChange={(value) => setOrgFilter(value ?? "all")}
            >
              <SelectTrigger id="org-filter">
                <SelectValue placeholder="كل الشركات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الشركات</SelectItem>
                {orgs.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {users.length === 0 ? (
          <EmptyStateBlock title="مفيش مستخدمين" description="لما تتأسس شركات، المستخدمين هيظهروا هنا." />
        ) : filteredUsers.length === 0 ? (
          <EmptyStateBlock title="مفيش نتائج" description="عدّل البحث أو فلتر الشركة." />
        ) : (
          <ResponsiveListLayout
            mobile={filteredUsers.map((user) => (
              <MobileEntityCard
                key={user.id}
                title={user.name}
                subtitle={user.email}
                badge={
                  <StatusPill
                    label={user.is_active ? "نشط" : "موقوف"}
                    variant={user.is_active ? "success" : "danger"}
                  />
                }
                fields={[
                  {
                    label: "الشركة",
                    value: (
                      <span className="flex flex-col gap-1">
                        <span>{user.org_name}</span>
                        <StatusPill
                          label={
                            user.org_status === "suspended" ? "شركة معلّقة" : "شركة نشطة"
                          }
                          variant={user.org_status === "suspended" ? "danger" : "success"}
                        />
                      </span>
                    ),
                  },
                  {
                    label: "الدور",
                    value: (
                      <Select
                        value={user.role}
                        disabled={pending}
                        onValueChange={(value) => {
                          if (!value) return;
                          startTransition(async () => {
                            const result = await setPlatformTenantUserRoleAction({
                              userId: user.id,
                              role: value as UserRole,
                            });
                            if (!result.ok) {
                              toast.error(result.error);
                              return;
                            }
                            toast.success("تم تغيير الدور");
                            refresh();
                          });
                        }}
                      >
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ),
                  },
                  {
                    label: "تاريخ",
                    value: user.created_at ? formatDateTime(user.created_at) : "—",
                  },
                ]}
                footer={
                  <div className="flex flex-wrap gap-2">
                    {user.is_active ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={pending}
                        onClick={() => setDeactivateUser(user)}
                      >
                        <Ban className="size-3.5" />
                        إيقاف
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await setPlatformTenantUserActiveAction({
                              userId: user.id,
                              isActive: true,
                            });
                            if (!result.ok) {
                              toast.error(result.error);
                              return;
                            }
                            toast.success("تم تفعيل المستخدم");
                            refresh();
                          });
                        }}
                      >
                        <CheckCircle2 className="size-3.5" />
                        تفعيل
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        setPasswordUser(user);
                        setNewPassword("");
                      }}
                    >
                      <KeyRound className="size-3.5" />
                      كلمة مرور
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending || !user.auth_user_id}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await signOutPlatformTenantUserAction(user.id);
                          if (!result.ok) {
                            toast.error(result.error);
                            return;
                          }
                          toast.success("تم إنهاء جلسات المستخدم");
                        });
                      }}
                    >
                      <LogOut className="size-3.5" />
                      إنهاء جلسات
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending || !user.auth_user_id || !user.is_active}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await createTenantImpersonationLinkAction(user.id);
                          if (!result.ok) {
                            toast.error(result.error);
                            return;
                          }
                          setImpersonateLink(result.data.actionLink);
                          setImpersonateEmail(result.data.email);
                          toast.success("تم توليد لينك دخول لمرة واحدة");
                        });
                      }}
                    >
                      <UserRoundSearch className="size-3.5" />
                      دخول كحسابه
                    </Button>
                  </div>
                }
              />
            ))}
            desktop={
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-2 py-2 text-start font-medium">المستخدم</th>
                      <th className="px-2 py-2 text-start font-medium">الشركة</th>
                      <th className="px-2 py-2 text-start font-medium">الدور</th>
                      <th className="px-2 py-2 text-start font-medium">الحالة</th>
                      <th className="px-2 py-2 text-start font-medium">تاريخ</th>
                      <th className="px-2 py-2 text-start font-medium">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b border-border/60 align-top">
                        <td className="px-2 py-3">
                          <p className="font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </td>
                        <td className="px-2 py-3">
                          <p>{user.org_name}</p>
                          <StatusPill
                            label={
                              user.org_status === "suspended" ? "شركة معلّقة" : "شركة نشطة"
                            }
                            variant={user.org_status === "suspended" ? "danger" : "success"}
                          />
                        </td>
                        <td className="px-2 py-3">
                          <Select
                            value={user.role}
                            disabled={pending}
                            onValueChange={(value) => {
                              if (!value) return;
                              startTransition(async () => {
                                const result = await setPlatformTenantUserRoleAction({
                                  userId: user.id,
                                  role: value as UserRole,
                                });
                                if (!result.ok) {
                                  toast.error(result.error);
                                  return;
                                }
                                toast.success("تم تغيير الدور");
                                refresh();
                              });
                            }}
                          >
                            <SelectTrigger className="h-8 w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {ROLE_LABELS[role]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-3">
                          <StatusPill
                            label={user.is_active ? "نشط" : "موقوف"}
                            variant={user.is_active ? "success" : "danger"}
                          />
                        </td>
                        <td className="px-2 py-3 whitespace-nowrap text-muted-foreground">
                          {user.created_at ? formatDateTime(user.created_at) : "—"}
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex flex-wrap gap-2">
                            {user.is_active ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={pending}
                                onClick={() => setDeactivateUser(user)}
                              >
                                <Ban className="size-3.5" />
                                إيقاف
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={pending}
                                onClick={() => {
                                  startTransition(async () => {
                                    const result = await setPlatformTenantUserActiveAction({
                                      userId: user.id,
                                      isActive: true,
                                    });
                                    if (!result.ok) {
                                      toast.error(result.error);
                                      return;
                                    }
                                    toast.success("تم تفعيل المستخدم");
                                    refresh();
                                  });
                                }}
                              >
                                <CheckCircle2 className="size-3.5" />
                                تفعيل
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending}
                              onClick={() => {
                                setPasswordUser(user);
                                setNewPassword("");
                              }}
                            >
                              <KeyRound className="size-3.5" />
                              كلمة مرور
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending || !user.auth_user_id}
                              onClick={() => {
                                startTransition(async () => {
                                  const result = await signOutPlatformTenantUserAction(user.id);
                                  if (!result.ok) {
                                    toast.error(result.error);
                                    return;
                                  }
                                  toast.success("تم إنهاء جلسات المستخدم");
                                });
                              }}
                            >
                              <LogOut className="size-3.5" />
                              إنهاء جلسات
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending || !user.auth_user_id || !user.is_active}
                              onClick={() => {
                                startTransition(async () => {
                                  const result = await createTenantImpersonationLinkAction(
                                    user.id
                                  );
                                  if (!result.ok) {
                                    toast.error(result.error);
                                    return;
                                  }
                                  setImpersonateLink(result.data.actionLink);
                                  setImpersonateEmail(result.data.email);
                                  toast.success("تم توليد لينك دخول لمرة واحدة");
                                });
                              }}
                            >
                              <UserRoundSearch className="size-3.5" />
                              دخول كحسابه
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          />
        )}
      </OperationalCard>

      <div className="grid gap-[var(--mds-space-6)] lg:grid-cols-2">
        <OperationalCard
          title="إنشاء مستخدم في شركة"
        >
          <form onSubmit={onCreateUser} className="space-y-[var(--mds-space-3)]">
            <div className="space-y-1.5">
              <Label htmlFor="create-org">الشركة</Label>
              <Select
                value={createOrgId || undefined}
                onValueChange={(value) => {
                  if (value) loadStores(value);
                }}
              >
                <SelectTrigger id="create-org">
                  <SelectValue placeholder="اختار شركة" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-name">الاسم</Label>
              <Input
                id="create-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-email">البريد</Label>
              <Input
                id="create-email"
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                required
                dir="ltr"
                className="text-start"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="create-role">الدور</Label>
                <Select
                  value={createRole}
                  onValueChange={(value) => {
                    if (value) setCreateRole(value as UserRole);
                  }}
                >
                  <SelectTrigger id="create-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-password">كلمة مرور مؤقتة</Label>
                <Input
                  id="create-password"
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  required
                  minLength={8}
                  dir="ltr"
                  className="text-start"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>الفروع</Label>
              {stores.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  اختار شركة أولاً لتحميل الفروع.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {stores.map((store) => {
                    const checked = createStoreIds.includes(store.id);
                    return (
                      <Button
                        key={store.id}
                        type="button"
                        size="sm"
                        variant={checked ? "default" : "outline"}
                        onClick={() => {
                          setCreateStoreIds((prev) =>
                            checked
                              ? prev.filter((id) => id !== store.id)
                              : [...prev, store.id]
                          );
                        }}
                      >
                        {store.name}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
            <Button type="submit" disabled={pending || !createOrgId}>
              <Plus className="size-3.5" />
              إنشاء مستخدم
            </Button>
          </form>
        </OperationalCard>

        <OperationalCard
          title="مشرفو المنصة"
        >
          <form onSubmit={onAddPlatformAdmin} className="mb-4 space-y-[var(--mds-space-3)]">
            <div className="space-y-1.5">
              <Label htmlFor="admin-email">البريد</Label>
              <Input
                id="admin-email"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
                dir="ltr"
                className="text-start"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-name">الاسم (اختياري)</Label>
              <Input
                id="admin-name"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={pending}>
              <Shield className="size-3.5" />
              إضافة / تحديث مشرف
            </Button>
          </form>

          {platformAdmins.length === 0 ? (
            <EmptyStateBlock title="مفيش مشرفين مسجّلين" description="الـ bootstrap من env هيشتغل عند أول دخول." />
          ) : (
            <ul className="space-y-2">
              {platformAdmins.map((admin) => (
                <li
                  key={admin.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--mds-radius-md)] border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{admin.name}</p>
                    <p className="truncate text-xs text-muted-foreground" dir="ltr">
                      {admin.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill
                      label={admin.is_active ? "نشط" : "موقوف"}
                      variant={admin.is_active ? "success" : "danger"}
                    />
                    <Button
                      size="sm"
                      variant={admin.is_active ? "destructive" : "outline"}
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await setPlatformAdminActiveAction({
                            platformAdminId: admin.id,
                            isActive: !admin.is_active,
                          });
                          if (!result.ok) {
                            toast.error(result.error);
                            return;
                          }
                          toast.success(admin.is_active ? "تم إيقاف المشرف" : "تم تفعيل المشرف");
                          refresh();
                        });
                      }}
                    >
                      {admin.is_active ? "إيقاف" : "تفعيل"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </OperationalCard>
      </div>

      <ConfirmActionDialog
        open={Boolean(deactivateUser)}
        onOpenChange={(open) => {
          if (!open) setDeactivateUser(null);
        }}
        title="إيقاف المستخدم؟"
        description={
          deactivateUser
            ? `هيتمنع ${deactivateUser.name} (${deactivateUser.email}) من تسجيل الدخول.`
            : ""
        }
        confirmLabel="إيقاف"
        destructive
        onConfirm={async () => {
          if (!deactivateUser) return;
          const result = await setPlatformTenantUserActiveAction({
            userId: deactivateUser.id,
            isActive: false,
          });
          if (!result.ok) {
            toast.error(result.error);
            throw new Error(result.error);
          }
          toast.success("تم إيقاف المستخدم");
          setDeactivateUser(null);
          refresh();
        }}
      />

      <Dialog
        open={Boolean(impersonateLink)}
        onOpenChange={(open) => {
          if (!open) {
            setImpersonateLink(null);
            setImpersonateEmail(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>لينك دخول كحساب المستخدم</DialogTitle>
            <DialogDescription>
              لينك لمرة واحدة لـ {impersonateEmail}. افتحه في نافذة خاصة، ومتشاركوش.
            </DialogDescription>
          </DialogHeader>
          <Input value={impersonateLink ?? ""} readOnly dir="ltr" className="text-start text-xs" />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                if (!impersonateLink) return;
                try {
                  await navigator.clipboard.writeText(impersonateLink);
                  toast.success("تم نسخ اللينك");
                } catch {
                  toast.error("مقدرناش ننسخ — انسخ يدوي");
                }
              }}
            >
              <Copy className="size-3.5" />
              نسخ
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (impersonateLink) window.open(impersonateLink, "_blank", "noopener,noreferrer");
              }}
            >
              فتح
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(passwordUser)}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordUser(null);
            setNewPassword("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تعيين كلمة مرور جديدة</DialogTitle>
            <DialogDescription>
              {passwordUser
                ? `للمستخدم ${passwordUser.name} — ${passwordUser.email}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">كلمة المرور (٨ أحرف على الأقل)</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              dir="ltr"
              className="text-start"
              autoComplete="new-password"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setPasswordUser(null);
                setNewPassword("");
              }}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              disabled={pending || newPassword.length < 8}
              onClick={() => {
                if (!passwordUser) return;
                startTransition(async () => {
                  const result = await resetPlatformTenantUserPasswordAction({
                    userId: passwordUser.id,
                    password: newPassword,
                  });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("تم تحديث كلمة المرور");
                  setPasswordUser(null);
                  setNewPassword("");
                });
              }}
            >
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
