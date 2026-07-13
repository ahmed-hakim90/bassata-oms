"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CheckCircle2, Copy, Download, Search } from "lucide-react";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { ConfirmActionDialog } from "@/components/SweetFlow/confirm-action-dialog";
import { KpiCard } from "@/components/SweetFlow/kpi-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import type {
  PlatformOrganizationSummary,
  PlatformRollup,
} from "@/modules/platform/services/platform-org.service";
import type { PlatformInviteRow } from "@/modules/platform/services/platform-invite.service";
import type { PlatformAuditLogRow } from "@/modules/platform/services/platform-audit.service";
import {
  createCompanyInviteAction,
  exportPlatformOrganizationsExcelAction,
  reactivateOrganizationAction,
  revokeCompanyInviteAction,
  suspendOrganizationAction,
} from "@/modules/platform/actions/platform.actions";

interface PlatformConsoleProps {
  organizations: PlatformOrganizationSummary[];
  rollup: PlatformRollup;
  invites: PlatformInviteRow[];
  auditLogs: PlatformAuditLogRow[];
}

const INVITE_STATUS_LABEL: Record<string, string> = {
  pending: "معلّقة",
  accepted: "مقبولة",
  revoked: "ملغاة",
  expired: "منتهية",
};

const INVITE_STATUS_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "danger" | "info"
> = {
  pending: "info",
  accepted: "success",
  revoked: "danger",
  expired: "warning",
};

export function PlatformConsole({
  organizations,
  rollup,
  invites,
  auditLogs,
}: PlatformConsoleProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [orgName, setOrgName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("14");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<PlatformOrganizationSummary | null>(
    null
  );
  const [confirmRevoke, setConfirmRevoke] = useState<PlatformInviteRow | null>(null);

  const filteredOrgs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter(
      (org) =>
        org.name.toLowerCase().includes(q) ||
        org.id.toLowerCase().includes(q) ||
        org.currency.toLowerCase().includes(q)
    );
  }, [organizations, search]);

  function refresh() {
    router.refresh();
  }

  function onCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createCompanyInviteAction({
        orgName,
        ownerName: ownerName || undefined,
        ownerEmail,
        expiresInDays: Number(expiresInDays) || 14,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCreatedToken(result.data.token);
      setOrgName("");
      setOwnerName("");
      setOwnerEmail("");
      toast.success("تم إنشاء الدعوة — انسخ التوكن دلوقتي، مش هيظهر تاني");
      refresh();
    });
  }

  async function copyToken(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      toast.success("تم نسخ التوكن");
    } catch {
      toast.error("مقدرناش ننسخ التوكن — انسخه يدوي");
    }
  }

  function onExport() {
    startTransition(async () => {
      const result = await exportPlatformOrganizationsExcelAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      downloadBase64Excel(result.data.base64, result.data.fileName);
      toast.success("تم تنزيل تقرير الشركات");
    });
  }

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]">
      <PageHeader
        title="إدارة المنصة"
        description="نظرة على كل الشركات، صحتهم التشغيلية، الدعوات، وسجل التدقيق. مفيش دخول لحسابات المستأجرين من هنا — ومفيش باقات أو اشتراكات."
        action={
          <Button
            type="button"
            variant="outline"
            disabled={pending || organizations.length === 0}
            onClick={onExport}
          >
            <Download className="size-3.5" />
            تصدير Excel
          </Button>
        }
      />

      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="شركات نشطة"
          value={String(rollup.orgActive)}
          change={`من أصل ${rollup.orgTotal}`}
          trend="neutral"
        />
        <KpiCard
          label="شركات معلّقة"
          value={String(rollup.orgSuspended)}
          change="موقوف تسجيل الدخول"
          trend={rollup.orgSuspended > 0 ? "down" : "neutral"}
        />
        <KpiCard
          label="دعوات معلّقة"
          value={String(rollup.pendingInvites)}
          change="بانتظار القبول"
          trend="neutral"
        />
        <KpiCard
          label="إجمالي الطلبات"
          value={String(rollup.orderTotal)}
          change={`${rollup.storeTotal} فرع · ${rollup.userTotal} مستخدم · ${rollup.deviceTotal} جهاز`}
          trend="neutral"
        />
      </div>

      <OperationalCard
        title="الشركات"
        description="تعليق الشركة يمنع تسجيل دخول مستخدميها. افتح التفاصيل لتقرير الصحة الكامل."
      >
        <div className="mb-[var(--mds-space-4)]">
          <Label htmlFor="org-search" className="sr-only">
            بحث عن شركة
          </Label>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="org-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو المعرّف…"
              className="ps-9"
              autoComplete="off"
            />
          </div>
        </div>

        {organizations.length === 0 ? (
          <EmptyStateBlock
            title="مفيش شركات لسه"
            description="لما تتأسس شركة من الدعوة، هتظهر هنا."
          />
        ) : filteredOrgs.length === 0 ? (
          <EmptyStateBlock
            title="مفيش نتائج"
            description="جرّب كلمة بحث تانية."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-2 text-start font-medium">الاسم</th>
                  <th className="px-2 py-2 text-start font-medium">الحالة</th>
                  <th className="px-2 py-2 text-start font-medium">فروع</th>
                  <th className="px-2 py-2 text-start font-medium">مستخدمين</th>
                  <th className="px-2 py-2 text-start font-medium">طلبات</th>
                  <th className="px-2 py-2 text-start font-medium">آخر طلب</th>
                  <th className="px-2 py-2 text-start font-medium">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.map((org) => {
                  const suspended = org.status === "suspended";
                  return (
                    <tr key={org.id} className="border-b border-border/60">
                      <td className="px-2 py-3">
                        <Link
                          href={`/platform/orgs/${org.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {org.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{org.currency}</p>
                      </td>
                      <td className="px-2 py-3">
                        <StatusPill
                          label={suspended ? "معلّقة" : "نشطة"}
                          variant={suspended ? "danger" : "success"}
                        />
                      </td>
                      <td className="px-2 py-3 tabular-nums text-muted-foreground">
                        {org.health.storeCount}
                      </td>
                      <td className="px-2 py-3 tabular-nums text-muted-foreground">
                        {org.health.userCount}
                      </td>
                      <td className="px-2 py-3 tabular-nums text-muted-foreground">
                        {org.health.orderCount}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground whitespace-nowrap">
                        {org.health.lastOrderAt
                          ? formatDateTime(org.health.lastOrderAt)
                          : "—"}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/platform/orgs/${org.id}`}
                            className="inline-flex h-8 items-center rounded-[var(--mds-radius-md)] border border-border bg-background px-3 text-[0.8125rem] font-medium hover:bg-muted"
                          >
                            تفاصيل
                          </Link>
                          {suspended ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending}
                              onClick={() => {
                                startTransition(async () => {
                                  const result = await reactivateOrganizationAction(org.id);
                                  if (!result.ok) {
                                    toast.error(result.error);
                                    return;
                                  }
                                  toast.success("تم إعادة تفعيل الشركة");
                                  refresh();
                                });
                              }}
                            >
                              <CheckCircle2 className="size-3.5" />
                              تفعيل
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={pending}
                              onClick={() => setConfirmSuspend(org)}
                            >
                              <Ban className="size-3.5" />
                              تعليق
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </OperationalCard>

      <div className="grid gap-[var(--mds-space-6)] lg:grid-cols-2">
        <OperationalCard title="دعوة شركة جديدة" description="التوكن يظهر مرة واحدة بس — انسخه وبعتّه للمالك.">
          <form onSubmit={onCreateInvite} className="space-y-[var(--mds-space-4)]">
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="invite-org">اسم الشركة</Label>
              <Input
                id="invite-org"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                placeholder="مثال: بساطة"
                autoComplete="organization"
              />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="invite-owner-name">اسم المالك (اختياري)</Label>
              <Input
                id="invite-owner-name"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="أحمد"
                autoComplete="name"
              />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="invite-owner-email">بريد المالك</Label>
              <Input
                id="invite-owner-email"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                required
                placeholder="owner@example.com"
                autoComplete="email"
                dir="ltr"
                className="text-start"
              />
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="invite-ttl">الصلاحية (أيام)</Label>
              <Input
                id="invite-ttl"
                type="number"
                min={1}
                max={90}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                required
                inputMode="numeric"
              />
            </div>
            <Button type="submit" disabled={pending}>
              إنشاء دعوة
            </Button>
          </form>

          {createdToken ? (
            <div className="mt-[var(--mds-space-4)] rounded-[var(--mds-radius-md)] border border-border bg-muted/30 p-[var(--mds-space-3)]">
              <p className="mb-2 text-sm font-medium">توكن الدعوة (مرة واحدة)</p>
              <div className="flex items-center gap-2">
                <code
                  className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1.5 text-xs"
                  dir="ltr"
                >
                  {createdToken}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copyToken(createdToken)}
                >
                  <Copy className="size-3.5" />
                  نسخ
                </Button>
              </div>
            </div>
          ) : null}
        </OperationalCard>

        <OperationalCard title="الدعوات" description="آخر الدعوات المنشأة من المنصة.">
          {invites.length === 0 ? (
            <EmptyStateBlock title="مفيش دعوات" description="أنشئ دعوة من النموذج المجاور." />
          ) : (
            <ul className="divide-y divide-border">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-medium">{invite.org_name}</p>
                    <p className="truncate text-xs text-muted-foreground" dir="ltr">
                      {invite.owner_email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      تنتهي: {formatDateTime(invite.expires_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill
                      label={INVITE_STATUS_LABEL[invite.status] ?? invite.status}
                      variant={INVITE_STATUS_VARIANT[invite.status] ?? "default"}
                    />
                    {invite.status === "pending" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => setConfirmRevoke(invite)}
                      >
                        إلغاء
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </OperationalCard>
      </div>

      <OperationalCard title="سجل المنصة" description="إجراءات التحكم (تعليق، دعوات، …).">
        {auditLogs.length === 0 ? (
          <EmptyStateBlock title="مفيش أحداث لسه" description="أي إجراء من اللوحة هيتسجّل هنا." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-2 text-start font-medium">الوقت</th>
                  <th className="px-2 py-2 text-start font-medium">الإجراء</th>
                  <th className="px-2 py-2 text-start font-medium">الكيان</th>
                  <th className="px-2 py-2 text-start font-medium">المعرّف</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-b border-border/60">
                    <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-2 py-2 font-medium">{log.action}</td>
                    <td className="px-2 py-2">{log.entity_type}</td>
                    <td className="px-2 py-2 font-mono text-xs" dir="ltr">
                      {log.entity_id.slice(0, 8)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </OperationalCard>

      <ConfirmActionDialog
        open={Boolean(confirmSuspend)}
        onOpenChange={(open) => {
          if (!open) setConfirmSuspend(null);
        }}
        title="تعليق الشركة؟"
        description={
          confirmSuspend
            ? `هيتمنع كل مستخدمي «${confirmSuspend.name}» من تسجيل الدخول لحد ما تعيد التفعيل.`
            : ""
        }
        confirmLabel="تعليق"
        destructive
        onConfirm={async () => {
          if (!confirmSuspend) return;
          const result = await suspendOrganizationAction(confirmSuspend.id);
          if (!result.ok) {
            toast.error(result.error);
            throw new Error(result.error);
          }
          toast.success("تم تعليق الشركة");
          refresh();
        }}
      />

      <ConfirmActionDialog
        open={Boolean(confirmRevoke)}
        onOpenChange={(open) => {
          if (!open) setConfirmRevoke(null);
        }}
        title="إلغاء الدعوة؟"
        description={
          confirmRevoke
            ? `هتلغي دعوة «${confirmRevoke.org_name}» لـ ${confirmRevoke.owner_email}.`
            : ""
        }
        confirmLabel="إلغاء الدعوة"
        destructive
        onConfirm={async () => {
          if (!confirmRevoke) return;
          const result = await revokeCompanyInviteAction(confirmRevoke.id);
          if (!result.ok) {
            toast.error(result.error);
            throw new Error(result.error);
          }
          toast.success("تم إلغاء الدعوة");
          refresh();
        }}
      />
    </div>
  );
}
