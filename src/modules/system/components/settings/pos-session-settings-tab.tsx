"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import {
  updateFeatureFlagsAction,
  updateOrgSettingsAction,
  updateReceiptFooterAction,
  updateSessionSettingsAction,
} from "@/modules/system/actions/system.actions";
import {
  POS_OPERATIONAL_FEATURE_FLAGS,
  type FeatureFlag,
} from "@/lib/constants";
import type { SessionSettings } from "@/lib/types";

const operationalFlagLabels: Record<(typeof POS_OPERATIONAL_FEATURE_FLAGS)[number], string> = {
  payment_cash: "الدفع النقدي",
  payment_card: "الدفع بالكارت",
  payment_wallet: "الدفع بالمحفظة",
  payment_other: "طرق دفع أخرى",
  receipt_printing: "طباعة الإيصالات",
  cash_drawer: "درج النقدية",
  tax: "الضريبة",
};

interface PosSessionSettingsTabProps {
  canManageSettings: boolean;
  canManageSessions: boolean;
  org?: {
    taxRate: number;
    taxInclusive: boolean;
  };
  receiptFooter?: string;
  featureFlags?: Record<FeatureFlag, boolean>;
  sessionSettings: SessionSettings;
}

export function PosSessionSettingsTab({
  canManageSettings,
  canManageSessions,
  org,
  receiptFooter = "",
  featureFlags,
  sessionSettings,
}: PosSessionSettingsTabProps) {
  const [pending, startTransition] = useTransition();
  const [sessionForm, setSessionForm] = useState(sessionSettings);
  const [posForm, setPosForm] = useState({
    taxRate: org?.taxRate ?? 0,
    taxInclusive: org?.taxInclusive ?? true,
    receiptFooter,
    operationalFlags: Object.fromEntries(
      POS_OPERATIONAL_FEATURE_FLAGS.map((flag) => [
        flag,
        featureFlags?.[flag] ?? true,
      ])
    ) as Record<(typeof POS_OPERATIONAL_FEATURE_FLAGS)[number], boolean>,
  });

  return (
    <div className="space-y-6">
      {canManageSettings && org && featureFlags ? (
        <OperationalCard title="الإيصالات والضريبة والدفع">
          <div className="grid max-w-lg gap-4">
            <div className="space-y-2">
              <Label>نسبة الضريبة (%)</Label>
              <Input
                type="number"
                step={0.01}
                value={posForm.taxRate * 100}
                onChange={(e) =>
                  setPosForm({
                    ...posForm,
                    taxRate: (parseFloat(e.target.value) || 0) / 100,
                  })
                }
              />
            </div>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={posForm.taxInclusive}
                onCheckedChange={(v) =>
                  setPosForm({ ...posForm, taxInclusive: v === true })
                }
              />
              <span className="text-sm">الأسعار شاملة الضريبة</span>
            </label>
            <div className="space-y-2">
              <Label>نهاية الإيصال</Label>
              <Input
                value={posForm.receiptFooter}
                onChange={(e) =>
                  setPosForm({ ...posForm, receiptFooter: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>خيارات الدفع والإيصال</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {POS_OPERATIONAL_FEATURE_FLAGS.map((flag) => (
                  <label
                    key={flag}
                    className="flex items-center gap-2 rounded-xl border border-border/60 p-3"
                  >
                    <Checkbox
                      checked={posForm.operationalFlags[flag]}
                      onCheckedChange={(v) =>
                        setPosForm({
                          ...posForm,
                          operationalFlags: {
                            ...posForm.operationalFlags,
                            [flag]: v === true,
                          },
                        })
                      }
                    />
                    <span className="text-sm">{operationalFlagLabels[flag]}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await updateOrgSettingsAction({
                      taxRate: posForm.taxRate,
                      taxInclusive: posForm.taxInclusive,
                    });
                    await updateReceiptFooterAction(posForm.receiptFooter);
                    await updateFeatureFlagsAction(posForm.operationalFlags);
                    toast.success("تم حفظ إعدادات الكاشير");
                  } catch {
                    toast.error("فشل الحفظ");
                  }
                })
              }
            >
              حفظ الإيصال والدفع
            </Button>
          </div>
        </OperationalCard>
      ) : null}

      {canManageSessions ? (
        <OperationalCard title="إعدادات الجلسة / الوردية">
          <div className="grid max-w-lg gap-4">
            <div className="space-y-2">
              <Label>أقصى ساعات فتح</Label>
              <Input
                type="number"
                min={1}
                value={sessionForm.max_open_hours}
                onChange={(e) =>
                  setSessionForm({
                    ...sessionForm,
                    max_open_hours: parseFloat(e.target.value) || 24,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>التحذير بعد عدد ساعات</Label>
              <Input
                type="number"
                min={0}
                value={sessionForm.warn_after_hours}
                onChange={(e) =>
                  setSessionForm({
                    ...sessionForm,
                    warn_after_hours: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={sessionForm.block_sales_when_expired}
                onCheckedChange={(v) =>
                  setSessionForm({
                    ...sessionForm,
                    block_sales_when_expired: v === true,
                  })
                }
              />
              <span className="text-sm">منع البيع عند انتهاء الجلسة</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={sessionForm.allow_manager_force_close}
                onCheckedChange={(v) =>
                  setSessionForm({
                    ...sessionForm,
                    allow_manager_force_close: v === true,
                  })
                }
              />
              <span className="text-sm">السماح للمدير بالإغلاق الإجباري</span>
            </label>
            <div className="space-y-2">
              <Label>موافقة المدير عند تجاوز مبلغ الخصم</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={sessionForm.manager_discount_override_amount ?? ""}
                placeholder="بدون حد"
                onChange={(e) =>
                  setSessionForm({
                    ...sessionForm,
                    manager_discount_override_amount:
                      e.target.value === "" ? null : Math.max(0, parseFloat(e.target.value) || 0),
                  })
                }
              />
            </div>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await updateSessionSettingsAction({
                      max_open_hours: sessionForm.max_open_hours,
                      warn_after_hours: sessionForm.warn_after_hours,
                      block_sales_when_expired: sessionForm.block_sales_when_expired,
                      allow_manager_force_close: sessionForm.allow_manager_force_close,
                      manager_discount_override_amount:
                        sessionForm.manager_discount_override_amount,
                    });
                    toast.success("تم حفظ إعدادات الجلسة");
                  } catch {
                    toast.error("فشل الحفظ");
                  }
                })
              }
            >
              حفظ إعدادات الجلسة
            </Button>
          </div>
        </OperationalCard>
      ) : null}
    </div>
  );
}
