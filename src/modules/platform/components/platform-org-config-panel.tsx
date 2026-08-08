"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FEATURE_FLAGS,
  type FeatureFlag,
} from "@/lib/constants";
import type { PlatformOrgConfig } from "@/modules/platform/services/platform-org-config.service";
import {
  updatePlatformOrgFeatureFlagsAction,
  updatePlatformOrgRemoteSettingsAction,
} from "@/modules/platform/actions/platform.actions";

const FLAG_LABELS: Partial<Record<FeatureFlag, string>> = {
  receipt_printing: "طباعة الإيصالات",
  barcode_scanner: "قارئ الباركود",
  inventory_deduction: "خصم المخزون",
  loyalty: "الولاء",
  customer_discounts: "خصومات العملاء",
  promotions: "العروض",
  reports: "التقارير",
  imports_exports: "استيراد/تصدير",
  cash_drawer: "درج النقدية",
  dark_mode: "الوضع الداكن",
  tax: "الضريبة",
  payment_cash: "نقدي",
  payment_card: "بطاقة",
  payment_wallet: "محفظة",
  payment_other: "طرق أخرى",
  prevent_negative_stock: "منع المخزون السالب",
  session_expenses: "مصروفات الجلسة",
  refunds: "مرتجعات",
  stock_count: "جرد",
  transfers: "تحويلات",
  purchases: "مشتريات",
  waste: "هالك",
  recipes: "وصفات",
  credit_sales: "بيع آجل",
};

export function PlatformOrgConfigPanel({ config }: { config: PlatformOrgConfig }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [flags, setFlags] = useState(config.featureFlags);
  const [currency, setCurrency] = useState(config.currency);
  const [timezone, setTimezone] = useState(config.timezone);
  const [country, setCountry] = useState(config.country);
  const [taxRate, setTaxRate] = useState(String(config.taxRate));
  const [taxInclusive, setTaxInclusive] = useState(config.taxInclusive);
  const [maxOpenHours, setMaxOpenHours] = useState(
    String(config.sessionSettings.max_open_hours)
  );
  const [warnAfterHours, setWarnAfterHours] = useState(
    String(config.sessionSettings.warn_after_hours)
  );
  const [blockExpired, setBlockExpired] = useState(
    config.sessionSettings.block_sales_when_expired
  );
  const [allowForceClose, setAllowForceClose] = useState(
    config.sessionSettings.allow_manager_force_close
  );

  return (
    <div className="grid gap-[var(--mds-space-6)] lg:grid-cols-2">
      <OperationalCard
        title="إعدادات عن بُعد"
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="currency">العملة</Label>
              <Input
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                dir="ltr"
                className="text-start"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone">المنطقة الزمنية</Label>
              <Input
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                dir="ltr"
                className="text-start"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="country">الدولة</Label>
              <Input
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tax">نسبة الضريبة (0–1)</Label>
              <Input
                id="tax"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                dir="ltr"
                className="text-start"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={taxInclusive}
              onCheckedChange={(v) => setTaxInclusive(Boolean(v))}
            />
            الضريبة شاملة السعر
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="max-hours">أقصى ساعات وردية</Label>
              <Input
                id="max-hours"
                value={maxOpenHours}
                onChange={(e) => setMaxOpenHours(e.target.value)}
                dir="ltr"
                className="text-start"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="warn-hours">تحذير بعد ساعات</Label>
              <Input
                id="warn-hours"
                value={warnAfterHours}
                onChange={(e) => setWarnAfterHours(e.target.value)}
                dir="ltr"
                className="text-start"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={blockExpired}
              onCheckedChange={(v) => setBlockExpired(Boolean(v))}
            />
            منع البيع عند انتهاء الجلسة
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allowForceClose}
              onCheckedChange={(v) => setAllowForceClose(Boolean(v))}
            />
            السماح بإغلاق إجباري للمدير
          </label>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await updatePlatformOrgRemoteSettingsAction({
                  orgId: config.orgId,
                  currency,
                  timezone,
                  country,
                  taxRate: Number(taxRate) || 0,
                  taxInclusive,
                  sessionSettings: {
                    max_open_hours: Number(maxOpenHours) || 24,
                    warn_after_hours: Number(warnAfterHours) || 20,
                    block_sales_when_expired: blockExpired,
                    allow_manager_force_close: allowForceClose,
                  },
                });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("تم حفظ الإعدادات");
                router.refresh();
              });
            }}
          >
            حفظ الإعدادات
          </Button>
        </div>
      </OperationalCard>

      <OperationalCard title="Feature flags">
        <div className="mb-3 max-h-[420px] space-y-2 overflow-y-auto pe-1">
          {FEATURE_FLAGS.map((flag) => (
            <label key={flag} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={flags[flag]}
                onCheckedChange={(v) =>
                  setFlags((prev) => ({ ...prev, [flag]: Boolean(v) }))
                }
              />
              <span>{FLAG_LABELS[flag] ?? flag}</span>
            </label>
          ))}
        </div>
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await updatePlatformOrgFeatureFlagsAction({
                orgId: config.orgId,
                flags,
              });
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success("تم حفظ الميزات");
              router.refresh();
            });
          }}
        >
          حفظ الميزات
        </Button>
      </OperationalCard>
    </div>
  );
}
