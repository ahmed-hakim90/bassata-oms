"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { ConfirmActionDialog } from "@/components/SweetFlow/confirm-action-dialog";
import {
  applyBusinessActivityPresetAction,
  updateBusinessActivitySettingsAction,
} from "@/modules/system/actions/system.actions";
import {
  BUSINESS_ACTIVITY_TYPES,
  BUSINESS_ACTIVITY_TYPE_LABELS,
  EXPIRY_POLICIES,
  INVENTORY_ROTATION_METHODS,
  INVENTORY_TRACKING_MODES,
  SALES_MODES,
  type BusinessActivitySettings,
  type BusinessActivityType,
  type ExpiryPolicy,
  type InventoryRotationMethod,
  type InventoryTrackingMode,
  type SalesMode,
} from "@/lib/constants";

const SALES_MODE_LABELS: Record<SalesMode, string> = {
  retail: "تجزئة",
  wholesale: "جملة",
};

const TRACKING_MODE_LABELS: Record<InventoryTrackingMode, string> = {
  none: "بدون تتبع",
  standard: "قياسي",
  batch: "دفعات",
  batch_and_expiry: "دفعات + صلاحية",
  serial_number: "رقم تسلسلي",
};

const ROTATION_METHOD_LABELS: Record<InventoryRotationMethod, string> = {
  FIFO: "FIFO — الأقدم أولاً",
  FEFO: "FEFO — الأقرب للانتهاء أولاً",
  MANUAL: "يدوي",
};

const EXPIRY_POLICY_LABELS: Record<ExpiryPolicy, string> = {
  block_sale: "منع البيع بعد الانتهاء",
  warn_only: "تحذير فقط",
  manager_override: "يتطلب موافقة مدير",
};

const selectClassName =
  "flex h-9 w-full rounded-[var(--mds-radius-md)] border border-input bg-transparent px-3 text-sm";

interface ActivitySettingsTabProps {
  businessActivity: BusinessActivitySettings;
}

export function ActivitySettingsTab({ businessActivity }: ActivitySettingsTabProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<BusinessActivitySettings>(businessActivity);
  const [presetConfirmOpen, setPresetConfirmOpen] = useState(false);
  const [saveTypeConfirmOpen, setSaveTypeConfirmOpen] = useState(false);

  useEffect(() => {
    setForm(businessActivity);
  }, [businessActivity]);

  const activityChanged = form.activity_type !== businessActivity.activity_type;

  const toggleSalesMode = (mode: SalesMode, enabled: boolean) => {
    setForm((prev) => {
      const enabled_sales_modes = enabled
        ? Array.from(new Set([...prev.enabled_sales_modes, mode]))
        : prev.enabled_sales_modes.filter((m) => m !== mode);
      const safeModes =
        enabled_sales_modes.length > 0 ? enabled_sales_modes : (["retail"] as SalesMode[]);
      const default_sales_mode = safeModes.includes(prev.default_sales_mode)
        ? prev.default_sales_mode
        : safeModes[0]!;
      return { ...prev, enabled_sales_modes: safeModes, default_sales_mode };
    });
  };

  const persistSettings = async () => {
    try {
      await updateBusinessActivitySettingsAction(form);
      toast.success("تم حفظ إعدادات النشاط");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل الحفظ");
      throw error;
    }
  };

  const requestSave = () => {
    if (activityChanged) {
      setSaveTypeConfirmOpen(true);
      return;
    }
    startTransition(async () => {
      try {
        await persistSettings();
      } catch {
        // toast already shown in persistSettings
      }
    });
  };

  const applyPreset = async () => {
    try {
      await applyBusinessActivityPresetAction(form.activity_type);
      toast.success("تم تطبيق إعدادات النشاط الافتراضية");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل تطبيق الإعدادات");
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      <OperationalCard title="نوع النشاط">
        <p className="mb-4 text-sm text-muted-foreground">
          نوع النشاط يحدد سلوك الكاشير والمنتجات والمخزون. تغيير النوع أو تطبيق الإعدادات
          الافتراضية يؤثر على سياسات البيع والمخزون — راجع قبل التأكيد.
        </p>
        <div className="grid max-w-lg gap-4">
          <div className="space-y-2">
            <Label htmlFor="activity-type">نوع النشاط</Label>
            <select
              id="activity-type"
              className={selectClassName}
              value={form.activity_type}
              onChange={(e) =>
                setForm({
                  ...form,
                  activity_type: e.target.value as BusinessActivityType,
                })
              }
            >
              {BUSINESS_ACTIVITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {BUSINESS_ACTIVITY_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setPresetConfirmOpen(true)}
            >
              تطبيق الإعدادات الافتراضية
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            تطبيق الإعدادات الافتراضية يعيد أوضاع البيع والوزن والجملة وقوالب المنتجات حسب نوع
            النشاط المختار.
          </p>
        </div>
      </OperationalCard>

      <OperationalCard title="أوضاع البيع">
        <div className="grid max-w-lg gap-4">
          <div className="space-y-2">
            <Label>الأوضاع المفعّلة</Label>
            <div className="flex flex-wrap gap-3">
              {SALES_MODES.map((mode) => (
                <label key={mode} className="flex items-center gap-2">
                  <Checkbox
                    checked={form.enabled_sales_modes.includes(mode)}
                    onCheckedChange={(v) => toggleSalesMode(mode, v === true)}
                  />
                  <span className="text-sm">{SALES_MODE_LABELS[mode]}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="default-sales-mode">الوضع الافتراضي</Label>
            <select
              id="default-sales-mode"
              className={selectClassName}
              value={form.default_sales_mode}
              onChange={(e) =>
                setForm({
                  ...form,
                  default_sales_mode: e.target.value as SalesMode,
                })
              }
            >
              {form.enabled_sales_modes.map((mode) => (
                <option key={mode} value={mode}>
                  {SALES_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.enable_piece_sales}
              onCheckedChange={(v) => setForm({ ...form, enable_piece_sales: v === true })}
            />
            <span className="text-sm">بيع بالقطعة</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.enable_weight_sales}
              onCheckedChange={(v) => setForm({ ...form, enable_weight_sales: v === true })}
            />
            <span className="text-sm">بيع بالوزن</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.enable_price_by_amount}
              onCheckedChange={(v) => setForm({ ...form, enable_price_by_amount: v === true })}
            />
            <span className="text-sm">البيع بالمبلغ (بدل الوزن)</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.enable_variants}
              onCheckedChange={(v) => setForm({ ...form, enable_variants: v === true })}
            />
            <span className="text-sm">خيارات المنتج (Variants)</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.enable_wholesale_sales}
              onCheckedChange={(v) => setForm({ ...form, enable_wholesale_sales: v === true })}
            />
            <span className="text-sm">بيع الجملة</span>
          </label>
          {form.enable_wholesale_sales ? (
            <div className="grid gap-3 rounded-[var(--mds-radius-lg)] border border-border/60 p-3">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={form.allow_cashier_wholesale}
                  onCheckedChange={(v) =>
                    setForm({ ...form, allow_cashier_wholesale: v === true })
                  }
                />
                <span className="text-sm">السماح للكاشير ببيع الجملة</span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={form.require_manager_for_wholesale}
                  onCheckedChange={(v) =>
                    setForm({ ...form, require_manager_for_wholesale: v === true })
                  }
                />
                <span className="text-sm">يتطلب موافقة مدير للجملة</span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={form.auto_apply_wholesale_by_quantity}
                  onCheckedChange={(v) =>
                    setForm({ ...form, auto_apply_wholesale_by_quantity: v === true })
                  }
                />
                <span className="text-sm">تطبيق الجملة تلقائيًا حسب الكمية</span>
              </label>
            </div>
          ) : null}
        </div>
      </OperationalCard>

      <OperationalCard title="إعدادات المخزون الافتراضية">
        <div className="grid max-w-lg gap-4">
          <div className="space-y-2">
            <Label htmlFor="tracking-mode">طريقة التتبع الافتراضية</Label>
            <select
              id="tracking-mode"
              className={selectClassName}
              value={form.default_inventory_tracking_mode}
              onChange={(e) =>
                setForm({
                  ...form,
                  default_inventory_tracking_mode: e.target.value as InventoryTrackingMode,
                })
              }
            >
              {INVENTORY_TRACKING_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {TRACKING_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rotation-method">طريقة الدوران</Label>
            <select
              id="rotation-method"
              className={selectClassName}
              value={form.default_inventory_rotation_method}
              onChange={(e) =>
                setForm({
                  ...form,
                  default_inventory_rotation_method: e.target.value as InventoryRotationMethod,
                })
              }
            >
              {INVENTORY_ROTATION_METHODS.map((method) => (
                <option key={method} value={method}>
                  {ROTATION_METHOD_LABELS[method]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expiry-policy">سياسة الصلاحية</Label>
            <select
              id="expiry-policy"
              className={selectClassName}
              value={form.default_expiry_policy}
              onChange={(e) =>
                setForm({
                  ...form,
                  default_expiry_policy: e.target.value as ExpiryPolicy,
                })
              }
            >
              {EXPIRY_POLICIES.map((policy) => (
                <option key={policy} value={policy}>
                  {EXPIRY_POLICY_LABELS[policy]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.enable_batch_tracking}
              onCheckedChange={(v) => setForm({ ...form, enable_batch_tracking: v === true })}
            />
            <span className="text-sm">تتبع الدفعات</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.enable_expiry_tracking}
              onCheckedChange={(v) => setForm({ ...form, enable_expiry_tracking: v === true })}
            />
            <span className="text-sm">تتبع الصلاحية</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={form.enable_serial_tracking}
              onCheckedChange={(v) => setForm({ ...form, enable_serial_tracking: v === true })}
            />
            <span className="text-sm">تتبع الرقم التسلسلي</span>
          </label>
          <Button type="button" disabled={pending} onClick={requestSave}>
            حفظ إعدادات النشاط
          </Button>
        </div>
      </OperationalCard>

      <ConfirmActionDialog
        open={presetConfirmOpen}
        onOpenChange={setPresetConfirmOpen}
        title="تطبيق إعدادات النشاط؟"
        description={
          activityChanged
            ? `هيتغيّر نوع النشاط من «${BUSINESS_ACTIVITY_TYPE_LABELS[businessActivity.activity_type]}» إلى «${BUSINESS_ACTIVITY_TYPE_LABELS[form.activity_type]}»، وهتتعاد أوضاع البيع وقوالب المنتجات حسب الإعدادات الافتراضية. تأكد إن ده مناسب لفرعكم الحالي.`
            : `هتتعاد أوضاع البيع والوزن والجملة وقوالب المنتجات حسب إعدادات «${BUSINESS_ACTIVITY_TYPE_LABELS[form.activity_type]}» الافتراضية. أي تخصيصات حالية على النشاط هتتكتب فوقها.`
        }
        confirmLabel="تطبيق الإعدادات"
        destructive={activityChanged}
        onConfirm={applyPreset}
      />

      <ConfirmActionDialog
        open={saveTypeConfirmOpen}
        onOpenChange={setSaveTypeConfirmOpen}
        title="تغيير نوع النشاط؟"
        description={`هيتغيّر نوع النشاط من «${BUSINESS_ACTIVITY_TYPE_LABELS[businessActivity.activity_type]}» إلى «${BUSINESS_ACTIVITY_TYPE_LABELS[form.activity_type]}» مع الإعدادات الحالية في النموذج. لتطبيق الإعدادات الافتراضية كاملة استخدم «تطبيق الإعدادات الافتراضية».`}
        confirmLabel="حفظ التغيير"
        destructive
        onConfirm={persistSettings}
      />
    </div>
  );
}
