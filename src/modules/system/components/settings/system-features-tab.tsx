"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { updateFeatureFlagsAction } from "@/modules/system/actions/system.actions";
import { ADVANCED_FEATURE_FLAGS, type FeatureFlag } from "@/lib/constants";

const featureFlagLabels: Partial<Record<FeatureFlag, string>> = {
  barcode_scanner: "قارئ الباركود",
  inventory_deduction: "خصم المخزون تلقائيًا",
  loyalty: "برنامج الولاء",
  customer_discounts: "خصومات العملاء",
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
};

const featureFlagHints: Partial<Record<FeatureFlag, string>> = {
  prevent_negative_stock:
    "مفعّل: الكاشير والأونلاين يتوقفان عند نقص الرصيد. معطّل: يُسمح بالبيع والرصيد يصبح سالبًا.",
};

interface SystemFeaturesTabProps {
  featureFlags: Record<FeatureFlag, boolean>;
  activityType?: import("@/lib/constants").BusinessActivityType;
}

export function SystemFeaturesTab({
  featureFlags,
  activityType,
}: SystemFeaturesTabProps) {
  const [pending, startTransition] = useTransition();
  const [flags, setFlags] = useState<Partial<Record<FeatureFlag, boolean>>>(() =>
    Object.fromEntries(
      ADVANCED_FEATURE_FLAGS.map((flag) => [flag, featureFlags[flag]])
    )
  );
  const recipesLocked = activityType === "supermarket";

  return (
    <OperationalCard title="خصائص النظام">
      <p className="mb-4 text-sm text-muted-foreground">
        مفاتيح تفعيل الموديولات المتقدمة. خيارات الكاشير اليومية مثل الدفع والإيصال والضريبة
        موجودة تحت تبويب الكاشير والجلسات.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ADVANCED_FEATURE_FLAGS.map((flag) => {
          const locked = recipesLocked && flag === "recipes";
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
                    مقفول لسوبر ماركت
                  </span>
                ) : featureFlagHints[flag] ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {featureFlagHints[flag]}
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
  );
}
