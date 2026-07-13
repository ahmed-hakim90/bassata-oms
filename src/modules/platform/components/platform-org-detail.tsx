"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Ban, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { KpiCard } from "@/components/SweetFlow/kpi-card";
import { ConfirmActionDialog } from "@/components/SweetFlow/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import type {
  PlatformOrganizationHealth,
  PlatformOrganizationRow,
} from "@/modules/platform/services/platform-org.service";
import {
  reactivateOrganizationAction,
  suspendOrganizationAction,
} from "@/modules/platform/actions/platform.actions";

interface PlatformOrgDetailProps {
  organization: PlatformOrganizationRow;
  health: PlatformOrganizationHealth;
}

function formatApproxBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PlatformOrgDetail({ organization, health }: PlatformOrgDetailProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const suspended = organization.status === "suspended";

  function refresh() {
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]">
      <PageHeader
        breadcrumb={
          <Link
            href="/platform"
            className="inline-flex items-center gap-1 text-[var(--mds-color-action-primary)] hover:underline"
          >
            <ArrowRight className="size-3.5" />
            كل الشركات
          </Link>
        }
        title={organization.name}
        description="تقرير صحة الشركة من المنصة. مفيش دخول لحساب المستأجر من هنا."
        meta={
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <StatusPill
              label={suspended ? "معلّقة" : "نشطة"}
              variant={suspended ? "danger" : "success"}
            />
            <span className="text-sm text-muted-foreground">
              {organization.currency} · {organization.country || "—"}
            </span>
            <span className="text-sm text-muted-foreground">
              أُنشئت: {formatDateTime(organization.created_at)}
            </span>
          </div>
        }
        action={
          suspended ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await reactivateOrganizationAction(organization.id);
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
              إعادة التفعيل
            </Button>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => setConfirmSuspend(true)}
            >
              <Ban className="size-3.5" />
              تعليق الشركة
            </Button>
          )
        }
      />

      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="فروع" value={String(health.storeCount)} trend="neutral" />
        <KpiCard label="مستخدمين" value={String(health.userCount)} trend="neutral" />
        <KpiCard label="أجهزة" value={String(health.deviceCount)} trend="neutral" />
        <KpiCard
          label="طلبات"
          value={String(health.orderCount)}
          change={
            health.lastOrderAt
              ? `آخر طلب: ${formatDateTime(health.lastOrderAt)}`
              : "مفيش طلبات مسجّلة"
          }
          trend="neutral"
        />
      </div>

      <OperationalCard title="حجم التشغيل" description="أعداد الكيانات عبر فروع الشركة.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <tbody className="divide-y divide-border">
              {[
                ["منتجات", health.productCount],
                ["عملاء", health.customerCount],
                ["طلبات", health.orderCount],
                ["مصروفات", health.expenseCount],
                ["مشتريات", health.purchaseCount],
                ["حركات مخزون", health.inventoryMovementCount],
                ["سجلات تدقيق داخلية", health.auditLogCount],
                ["حجم تقريبي", formatApproxBytes(health.databaseBytes)],
              ].map(([label, value]) => (
                <tr key={String(label)}>
                  <td className="px-2 py-3 font-medium text-muted-foreground">{label}</td>
                  <td className="px-2 py-3 text-end tabular-nums font-semibold">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-[var(--mds-space-3)] text-xs text-muted-foreground" dir="ltr">
          org_id: {organization.id}
        </p>
      </OperationalCard>

      <ConfirmActionDialog
        open={confirmSuspend}
        onOpenChange={setConfirmSuspend}
        title="تعليق الشركة؟"
        description={`هيتمنع كل مستخدمي «${organization.name}» من تسجيل الدخول لحد ما تعيد التفعيل.`}
        confirmLabel="تعليق"
        destructive
        onConfirm={async () => {
          const result = await suspendOrganizationAction(organization.id);
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
