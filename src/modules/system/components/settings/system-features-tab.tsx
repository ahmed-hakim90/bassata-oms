"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { updateFeatureFlagsAction } from "@/modules/system/actions/system.actions";
import { ADVANCED_FEATURE_FLAGS, type FeatureFlag } from "@/lib/constants";
import { ReportScheduleCard } from "@/modules/reports/components/report-schedule-card";
import type { ReportScheduleSettings } from "@/modules/reports/lib/report-schedule";

const featureFlagLabels: Partial<Record<FeatureFlag, string>> = {
  barcode_scanner: "قارئ الباركود",
  inventory_deduction: "خصم المخزون تلقائيًا",
  loyalty: "برنامج الولاء",
  customer_discounts: "خصومات العملاء",
  promotions: "محرك العروض",
  reports: "التقارير",
  imports_exports: "الاستيراد والتصدير",
  dark_mode: "الوضع الداكن",
  prevent_negative_stock: "منع المخزون السالب",
  session_expenses: "مصروفات الجلسة",
  refunds: "المرتجعات",
  stock_count: "جرد المخزون",
  transfers: "التحويلات",
  purchases: "المشتريات",
  waste: "الهالك",
  recipes: "الوصفات",
  credit_sales: "البيع الآجل",
  monthly_closing: "الإقفال الشهري",
  general_ledger: "دفتر الأستاذ العام",
};

const featureFlagHints: Partial<Record<FeatureFlag, string>> = {
  prevent_negative_stock:
    "مفعّل: الكاشير والأونلاين يتوقفان عند نقص الرصيد. معطّل: يُسمح بالبيع والرصيد يصبح سالبًا.",
  monthly_closing:
    "بعد إقفال الفترة يتوقف البيع والمخزون والمصروفات على التواريخ داخل الفترة المقفولة.",
  general_ledger:
    "دليل الحسابات والقيود اليومية وميزان المراجعة — مع ترحيل تلقائي من البيع والمصروفات والمدفوعات.",
};

interface SystemFeaturesTabProps {
  featureFlags: Record<FeatureFlag, boolean>;
  activityType?: import("@/lib/constants").BusinessActivityType;
  reportSchedule?: ReportScheduleSettings | null;
  canManageSchedule?: boolean;
}

export function SystemFeaturesTab({
  featureFlags,
  activityType,
  reportSchedule = null,
  canManageSchedule = false,
}: SystemFeaturesTabProps) {
  const [pending, startTransition] = useTransition();
  const [flags, setFlags] = useState<Partial<Record<FeatureFlag, boolean>>>(() =>
    Object.fromEntries(
      ADVANCED_FEATURE_FLAGS.map((flag) => [flag, featureFlags[flag]])
    )
  );
  const recipesLocked =
    activityType === "supermarket" || activityType === "pharmacy";
  const creditHint =
    activityType === "wholesale" || activityType === "mixed"
      ? "مفعّل افتراضيًا لأنشطة الجملة/المختلط من إعدادات النشاط."
      : undefined;

  return (
    <div className="flex flex-col gap-4">
      <OperationalCard title="خصائص النظام">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ADVANCED_FEATURE_FLAGS.map((flag) => {
            const locked = recipesLocked && flag === "recipes";
            const hint =
              flag === "credit_sales" && creditHint
                ? creditHint
                : featureFlagHints[flag];
            return (
              <label
                key={flag}
                className={`flex items-start gap-2 rounded-[var(--mds-radius-lg)] border border-border/60 p-[var(--mds-space-3)] ${locked ? "opacity-60" : ""}`}
              >
                <Checkbox
                  checked={flags[flag]}
                  disabled={locked}
                  onCheckedChange={(v) => {
                    if (locked) return;
                    setFlags({ ...flags, [flag]: v === true });
                  }}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block text-sm">{featureFlagLabels[flag] ?? flag}</span>
                  {locked ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {activityType === "pharmacy"
                        ? "مقفول لصيدلية (كتالوج بسيط بدون وصفات)"
                        : "مقفول لسوبر ماركت"}
                    </span>
                  ) : hint ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {hint}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
        <Button
          disabled={pending}
          className="mt-4"
          onClick={() =>
            startTransition(async () => {
              try {
                const patch = Object.fromEntries(
                  ADVANCED_FEATURE_FLAGS.map((flag) => [flag, flags[flag]])
                ) as Partial<Record<FeatureFlag, boolean>>;
                await updateFeatureFlagsAction(patch);
                toast.success("تم حفظ خصائص النظام");
              } catch {
                toast.error("فشل الحفظ");
              }
            })
          }
        >
          حفظ خصائص النظام
        </Button>
      </OperationalCard>

      {reportSchedule ? (
        <div id="report-schedule">
          <ReportScheduleCard
            initial={reportSchedule}
            canManage={canManageSchedule}
          />
        </div>
      ) : null}
    </div>
  );
}
