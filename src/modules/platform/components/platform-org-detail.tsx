"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { toast } from "sonner";
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  Gauge,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { StatusPill } from "@/components/Velora/status-pill";
import { KpiCard } from "@/components/Velora/kpi-card";
import { ConfirmActionDialog } from "@/components/Velora/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import type {
  PlatformOrganizationHealth,
  PlatformOrganizationRow,
} from "@/modules/platform/services/platform-org.service";
import type { PlatformOrgConfig } from "@/modules/platform/services/platform-org-config.service";
import {
  usagePressure,
  type PlatformPlan,
  type PlatformUsage,
} from "@/modules/platform/services/platform-plan.service";
import type { PlatformWebhookConfig } from "@/modules/platform/services/platform-webhooks.service";
import type { OrgCustomDomain } from "@/modules/platform/services/platform-custom-domain.service";
import { PlatformOrgConfigPanel } from "@/modules/platform/components/platform-org-config-panel";
import { PlatformOrgPlanWebhookPanel } from "@/modules/platform/components/platform-org-plan-webhook-panel";
import { PlatformCustomDomainPanel } from "@/modules/platform/components/platform-custom-domain-panel";
import {
  exportOrganizationFullDataAction,
  exportOrganizationLifecycleAction,
  reactivateOrganizationAction,
  suspendOrganizationAction,
} from "@/modules/platform/actions/platform.actions";
import { PlatformOrgMenuThemesPanel } from "@/modules/platform/components/platform-org-menu-themes-panel";
import type {
  MenuThemeAccessRow,
  MenuThemeEntitlements,
} from "@/modules/online-menu/lib/menu-theme-commerce";

function limitLabel(value: number | null): string {
  return value == null ? "∞" : String(value);
}

interface PlatformOrgDetailProps {
  organization: PlatformOrganizationRow;
  health: PlatformOrganizationHealth;
  config: PlatformOrgConfig;
  plan: PlatformPlan;
  usage: PlatformUsage;
  webhook: PlatformWebhookConfig;
  customDomain: OrgCustomDomain;
  menuThemeRows: MenuThemeAccessRow[];
  menuThemeEntitlements: MenuThemeEntitlements;
}

function formatApproxBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PlatformOrgDetail({
  organization,
  health,
  config,
  plan,
  usage,
  webhook,
  customDomain,
  menuThemeRows,
  menuThemeEntitlements,
}: PlatformOrgDetailProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmSuspend, setConfirmSuspend] = useState<"ops" | "non_payment" | null>(
    null
  );
  const suspended = organization.status === "suspended";

  function refresh() {
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
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
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setConfirmSuspend("non_payment")}
              >
                <Ban className="size-3.5" />
                تعليق لعدم السداد
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() => setConfirmSuspend("ops")}
              >
                <Ban className="size-3.5" />
                تعليق الشركة
              </Button>
            </div>
          )
        }
      />

      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="فروع (استهلاك)"
          value={`${usage.stores}/${limitLabel(plan.max_stores)}`}
          change={
            usagePressure(usage.stores, plan.max_stores) === "over"
              ? "تجاوز الحد"
              : usagePressure(usage.stores, plan.max_stores) === "near"
                ? "قرب الحد"
                : plan.plan
          }
          trend={
            usagePressure(usage.stores, plan.max_stores) === "over" ? "down" : "neutral"
          }
        />
        <KpiCard
          label="مستخدمين نشطين"
          value={`${usage.users}/${limitLabel(plan.max_users)}`}
          change={`إجمالي المسجّلين: ${health.userCount}`}
          trend={
            usagePressure(usage.users, plan.max_users) === "over" ? "down" : "neutral"
          }
        />
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

      <OperationalCard title="اختصارات التحكم">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/platform/usage"
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--mds-radius-md)] border border-border bg-background px-3.5 text-sm font-medium hover:bg-muted"
          >
            <Gauge className="size-3.5" />
            مصفوفة الاستهلاك
          </Link>
          <Link
            href="/platform/users"
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--mds-radius-md)] border border-border bg-background px-3.5 text-sm font-medium hover:bg-muted"
          >
            <Users className="size-3.5" />
            مستخدمو المنصة
          </Link>
        </div>
      </OperationalCard>

      <OperationalCard title="حجم التشغيل">
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

      <PlatformCustomDomainPanel
        orgId={organization.id}
        domain={customDomain}
        allowCustomDomain={plan.allow_custom_domain}
      />

      <PlatformOrgMenuThemesPanel
        orgId={organization.id}
        initialRows={menuThemeRows}
        initialEntitlements={menuThemeEntitlements}
      />

      <OperationalCard title="دورة حياة البيانات">
        <p className="mb-3 text-sm text-muted-foreground">
          ملخص سريع أو تصدير تشغيلي كامل (JSONB). الحذف الكامل مؤجّل. الاستعادة عبر Supabase PITR.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await exportOrganizationLifecycleAction(organization.id);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                if (!result.data) {
                  toast.error("فشل التصدير");
                  return;
                }
                const blob = new Blob([JSON.stringify(result.data, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `org-${organization.id}-lifecycle.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("تم تنزيل ملخص البيانات");
              });
            }}
          >
            تصدير ملخص JSON
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await exportOrganizationFullDataAction(organization.id);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                if (!result.data) {
                  toast.error("فشل التصدير");
                  return;
                }
                const blob = new Blob([JSON.stringify(result.data)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `org-${organization.id}-full-export.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("تم تنزيل التصدير الكامل");
              });
            }}
          >
            تصدير بيانات كاملة
          </Button>
        </div>
      </OperationalCard>

      <PlatformOrgPlanWebhookPanel
        orgId={organization.id}
        plan={plan}
        usage={usage}
        webhook={webhook}
      />

      <PlatformOrgConfigPanel config={config} />

      <ConfirmActionDialog
        open={Boolean(confirmSuspend)}
        onOpenChange={(open) => {
          if (!open) setConfirmSuspend(null);
        }}
        title={
          confirmSuspend === "non_payment" ? "تعليق لعدم السداد؟" : "تعليق الشركة؟"
        }
        description={
          confirmSuspend === "non_payment"
            ? `هيتمنع دخول «${organization.name}» ويُسجَّل السبب في التدقيق وملاحظات الباقة. إعادة التفعيل يدوية بعد التحصيل.`
            : `هيتمنع كل مستخدمي «${organization.name}» من تسجيل الدخول لحد ما تعيد التفعيل.`
        }
        confirmLabel={confirmSuspend === "non_payment" ? "تعليق لعدم السداد" : "تعليق"}
        destructive
        onConfirm={async () => {
          if (!confirmSuspend) return;
          const result = await suspendOrganizationAction(organization.id, {
            reason: confirmSuspend,
          });
          if (!result.ok) {
            toast.error(result.error);
            throw new Error(result.error);
          }
          toast.success(
            confirmSuspend === "non_payment"
              ? "تم التعليق لعدم السداد"
              : "تم تعليق الشركة"
          );
          refresh();
        }}
      />
    </div>
  );
}
