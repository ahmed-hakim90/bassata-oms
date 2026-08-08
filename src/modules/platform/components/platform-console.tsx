"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Ban,
  CheckCircle2,
  Download,
  Gauge,
  ScrollText,
  Search,
  UserPlus,
} from "lucide-react";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { StatusPill } from "@/components/Velora/status-pill";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { ConfirmActionDialog } from "@/components/Velora/confirm-action-dialog";
import { KpiCard } from "@/components/Velora/kpi-card";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { ResponsiveListLayout } from "@/components/Velora/responsive-list-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import type {
  PlatformOrganizationSummary,
  PlatformRollup,
} from "@/modules/platform/services/platform-org.service";
import {
  exportPlatformOrganizationsExcelAction,
  reactivateOrganizationAction,
  suspendOrganizationAction,
} from "@/modules/platform/actions/platform.actions";

interface PlatformConsoleProps {
  organizations: PlatformOrganizationSummary[];
  rollup: PlatformRollup;
}

export function PlatformConsole({ organizations, rollup }: PlatformConsoleProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [confirmSuspend, setConfirmSuspend] = useState<PlatformOrganizationSummary | null>(
    null
  );

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
        description="تحكم كامل في الشركات: تعليق، تفعيل، استهلاك، ودعوات."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/platform/usage"
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--mds-radius-md)] border border-border bg-background px-3.5 text-sm font-medium hover:bg-muted"
            >
              <Gauge className="size-3.5" />
              الاستهلاك
            </Link>
            <Link
              href="/platform/invites"
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--mds-radius-md)] border border-border bg-background px-3.5 text-sm font-medium hover:bg-muted"
            >
              <UserPlus className="size-3.5" />
              دعوات
            </Link>
            <Link
              href="/platform/audit"
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--mds-radius-md)] border border-border bg-background px-3.5 text-sm font-medium hover:bg-muted"
            >
              <ScrollText className="size-3.5" />
              السجل
            </Link>
            <Button
              type="button"
              variant="outline"
              disabled={pending || organizations.length === 0}
              onClick={onExport}
            >
              <Download className="size-3.5" />
              تصدير Excel
            </Button>
          </div>
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
          change={`${rollup.storeTotal} فرع · ${rollup.userTotal} مستخدم`}
          trend="neutral"
        />
      </div>

      <OperationalCard title="الشركات">
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
          <EmptyStateBlock title="مفيش نتائج" description="جرّب كلمة بحث تانية." />
        ) : (
          <ResponsiveListLayout
            mobile={filteredOrgs.map((org) => {
              const suspended = org.status === "suspended";
              return (
                <MobileEntityCard
                  key={org.id}
                  title={org.name}
                  subtitle={org.currency}
                  badge={
                    <StatusPill
                      label={suspended ? "معلّقة" : "نشطة"}
                      variant={suspended ? "danger" : "success"}
                    />
                  }
                  fields={[
                    { label: "فروع", value: org.health.storeCount },
                    { label: "مستخدمين", value: org.health.userCount },
                    { label: "طلبات", value: org.health.orderCount },
                    {
                      label: "آخر طلب",
                      value: org.health.lastOrderAt
                        ? formatDateTime(org.health.lastOrderAt)
                        : "—",
                    },
                  ]}
                  footer={
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/platform/orgs/${org.id}`}
                        className="inline-flex h-8 items-center rounded-[var(--mds-radius-md)] border border-border bg-background px-3 text-[0.8125rem] font-medium hover:bg-muted"
                      >
                        تحكم كامل
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
                  }
                />
              );
            })}
            desktop={
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
                                تحكم كامل
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
            }
          />
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
    </div>
  );
}
