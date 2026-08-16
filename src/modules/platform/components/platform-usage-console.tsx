"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Search } from "lucide-react";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { StatusPill } from "@/components/Velora/status-pill";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { ResponsiveListLayout } from "@/components/Velora/responsive-list-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import { buildPlatformUsageGlance } from "@/modules/platform/lib/platform-glance";
import { PlatformUsageAnalyticsGlance } from "@/modules/platform/components/platform-usage-analytics-glance";
import {
  type PlatformOrgUsageRow,
  type PlatformPlanId,
  type PlatformUsagePressure,
} from "@/modules/platform/services/platform-plan.service";
import { exportPlatformUsageExcelAction } from "@/modules/platform/actions/platform.actions";

const PLAN_LABELS: Record<PlatformPlanId, string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
  custom: "مخصص",
};

function limitLabel(value: number | null): string {
  return value == null ? "∞" : String(value);
}

function formatApproxBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function pressureVariant(
  pressure: PlatformUsagePressure
): "default" | "success" | "warning" | "danger" {
  if (pressure === "over") return "danger";
  if (pressure === "near") return "warning";
  return "success";
}

function pressureLabel(pressure: PlatformUsagePressure): string {
  if (pressure === "over") return "تجاوز";
  if (pressure === "near") return "قرب الحد";
  return "طبيعي";
}

function UsageCell({
  current,
  limit,
  pressure,
}: {
  current: number;
  limit: number | null;
  pressure: PlatformUsagePressure;
}) {
  const pct =
    limit != null && limit > 0
      ? Math.min(100, Math.round((current / limit) * 100))
      : null;

  return (
    <div className="min-w-[7rem] space-y-1">
      <div className="flex items-center justify-between gap-2 text-sm tabular-nums">
        <span className="font-semibold">
          {current}/{limitLabel(limit)}
        </span>
        {pct != null ? (
          <span className="text-xs text-muted-foreground">{pct}%</span>
        ) : null}
      </div>
      {pct != null ? (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="meter"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={
              pressure === "over"
                ? "h-full bg-[var(--mds-color-feedback-danger)]"
                : pressure === "near"
                  ? "h-full bg-[var(--mds-color-feedback-warning)]"
                  : "h-full bg-[var(--mds-color-feedback-success)]"
            }
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <p className="text-[0.6875rem] text-muted-foreground">بدون حد</p>
      )}
    </div>
  );
}

export function PlatformUsageConsole({ rows }: { rows: PlatformOrgUsageRow[] }) {
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [pressureFilter, setPressureFilter] = useState<"all" | PlatformUsagePressure>(
    "all"
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (pressureFilter !== "all" && row.pressure.worst !== pressureFilter) {
        return false;
      }
      if (!q) return true;
      return (
        row.org_name.toLowerCase().includes(q) ||
        row.org_id.toLowerCase().includes(q) ||
        PLAN_LABELS[row.plan.plan].toLowerCase().includes(q)
      );
    });
  }, [rows, search, pressureFilter]);

  const glance = useMemo(() => buildPlatformUsageGlance(rows), [rows]);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="الاستهلاك والحدود"
        description="مقارنة الباقة مع الاستخدام الفعلي لكل شركة (فروع / مستخدمين نشطين / سجلات تشغيل)."
        action={
          <Button
            type="button"
            variant="outline"
            disabled={pending || rows.length === 0}
            onClick={() => {
              startTransition(async () => {
                const result = await exportPlatformUsageExcelAction();
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                downloadBase64Excel(result.data.base64, result.data.fileName);
                toast.success("تم تنزيل تقرير الاستهلاك");
              });
            }}
          >
            <Download className="size-3.5" />
            تصدير Excel
          </Button>
        }
      />

      <PlatformUsageAnalyticsGlance glance={glance} />

      <OperationalCard title="مصفوفة الاستهلاك">
        <div className="mb-[var(--mds-space-4)] flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Label htmlFor="usage-search" className="sr-only">
              بحث
            </Label>
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="usage-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالشركة أو الباقة…"
              className="ps-9"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "الكل"],
                ["over", "تجاوز"],
                ["near", "قرب الحد"],
                ["ok", "طبيعي"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={pressureFilter === value ? "default" : "outline"}
                onClick={() => setPressureFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyStateBlock
            title="مفيش شركات"
            description="لما تتأسس شركة هتظهر هنا مع استهلاكها."
          />
        ) : filtered.length === 0 ? (
          <EmptyStateBlock title="مفيش نتائج" description="غيّر البحث أو الفلتر." />
        ) : (
          <ResponsiveListLayout
            mobile={filtered.map((row) => {
              const suspended = row.org_status === "suspended";
              return (
                <MobileEntityCard
                  key={row.org_id}
                  title={row.org_name}
                  subtitle={`${PLAN_LABELS[row.plan.plan]} · ${row.currency}`}
                  badge={
                    <StatusPill
                      label={pressureLabel(row.pressure.worst)}
                      variant={pressureVariant(row.pressure.worst)}
                    />
                  }
                  fields={[
                    {
                      label: "الحالة",
                      value: (
                        <StatusPill
                          label={suspended ? "معلّقة" : "نشطة"}
                          variant={suspended ? "danger" : "success"}
                        />
                      ),
                    },
                    {
                      label: "فروع",
                      value: (
                        <UsageCell
                          current={row.usage.stores}
                          limit={row.plan.max_stores}
                          pressure={row.pressure.stores}
                        />
                      ),
                    },
                    {
                      label: "مستخدمين",
                      value: (
                        <UsageCell
                          current={row.usage.users}
                          limit={row.plan.max_users}
                          pressure={row.pressure.users}
                        />
                      ),
                    },
                    {
                      label: "سجلات",
                      value: (
                        <UsageCell
                          current={row.usage.devices}
                          limit={row.plan.max_devices}
                          pressure={row.pressure.devices}
                        />
                      ),
                    },
                    {
                      label: "طلبات",
                      value: row.order_count,
                    },
                    {
                      label: "آخر طلب",
                      value: row.last_order_at
                        ? formatDateTime(row.last_order_at)
                        : "—",
                    },
                  ]}
                  footer={
                    <Link
                      href={`/platform/orgs/${row.org_id}`}
                      className="inline-flex h-8 items-center rounded-[var(--mds-radius-md)] border border-border bg-background px-3 text-[0.8125rem] font-medium hover:bg-muted"
                    >
                      باقة وتحكم
                    </Link>
                  }
                />
              );
            })}
            desktop={
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-2 py-2 text-start font-medium">الشركة</th>
                      <th className="px-2 py-2 text-start font-medium">الباقة</th>
                      <th className="px-2 py-2 text-start font-medium">فروع</th>
                      <th className="px-2 py-2 text-start font-medium">مستخدمين</th>
                      <th className="px-2 py-2 text-start font-medium">سجلات</th>
                      <th className="px-2 py-2 text-start font-medium">ضغط</th>
                      <th className="px-2 py-2 text-start font-medium">تشغيل</th>
                      <th className="px-2 py-2 text-start font-medium">تحكم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => {
                      const suspended = row.org_status === "suspended";
                      return (
                        <tr key={row.org_id} className="border-b border-border/60 align-top">
                          <td className="px-2 py-3">
                            <Link
                              href={`/platform/orgs/${row.org_id}`}
                              className="font-medium hover:underline"
                            >
                              {row.org_name}
                            </Link>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <StatusPill
                                label={suspended ? "معلّقة" : "نشطة"}
                                variant={suspended ? "danger" : "success"}
                              />
                              <span className="text-xs text-muted-foreground">
                                {row.currency}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            <p className="font-medium">{PLAN_LABELS[row.plan.plan]}</p>
                            {row.plan.notes ? (
                              <p className="mt-1 max-w-[12rem] truncate text-xs text-muted-foreground">
                                {row.plan.notes}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-2 py-3">
                            <UsageCell
                              current={row.usage.stores}
                              limit={row.plan.max_stores}
                              pressure={row.pressure.stores}
                            />
                          </td>
                          <td className="px-2 py-3">
                            <UsageCell
                              current={row.usage.users}
                              limit={row.plan.max_users}
                              pressure={row.pressure.users}
                            />
                          </td>
                          <td className="px-2 py-3">
                            <UsageCell
                              current={row.usage.devices}
                              limit={row.plan.max_devices}
                              pressure={row.pressure.devices}
                            />
                          </td>
                          <td className="px-2 py-3">
                            <StatusPill
                              label={pressureLabel(row.pressure.worst)}
                              variant={pressureVariant(row.pressure.worst)}
                            />
                          </td>
                          <td className="px-2 py-3 text-xs text-muted-foreground">
                            <p>
                              طلبات:{" "}
                              <span className="tabular-nums font-medium text-foreground">
                                {row.order_count}
                              </span>
                            </p>
                            <p>
                              منتجات/عملاء:{" "}
                              <span className="tabular-nums font-medium text-foreground">
                                {row.product_count}/{row.customer_count}
                              </span>
                            </p>
                            <p>حجم: {formatApproxBytes(row.database_bytes)}</p>
                            <p>
                              آخر طلب:{" "}
                              {row.last_order_at
                                ? formatDateTime(row.last_order_at)
                                : "—"}
                            </p>
                          </td>
                          <td className="px-2 py-3">
                            <Link
                              href={`/platform/orgs/${row.org_id}`}
                              className="inline-flex h-8 items-center rounded-[var(--mds-radius-md)] border border-border bg-background px-3 text-[0.8125rem] font-medium hover:bg-muted"
                            >
                              باقة وتحكم
                            </Link>
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
    </div>
  );
}
