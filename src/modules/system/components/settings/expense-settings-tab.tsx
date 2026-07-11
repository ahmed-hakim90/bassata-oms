"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { updateExpenseSettingsAction } from "@/modules/system/actions/system.actions";
import { CostCentersPage } from "@/modules/accounting/components/cost-centers-page";
import type { CostCenter, ExpenseCategory, ExpenseSettings } from "@/lib/types";

const costCenterDefaultsLabels = {
  packaging: "التعبئة والتغليف",
  cleaning: "النظافة",
  utilities: "المرافق",
} as const;

interface ExpenseSettingsTabProps {
  canManageExpenseSettings: boolean;
  canManageCostCenters: boolean;
  expenseSettings?: ExpenseSettings;
  costCenters?: CostCenter[];
  costCentersPage?: {
    centers: CostCenter[];
    categories: ExpenseCategory[];
    activeStoreId: string | null;
  } | null;
}

export function ExpenseSettingsTab({
  canManageExpenseSettings,
  canManageCostCenters,
  expenseSettings,
  costCenters = [],
  costCentersPage,
}: ExpenseSettingsTabProps) {
  const [pending, startTransition] = useTransition();
  const [expenseForm, setExpenseForm] = useState(
    expenseSettings ?? {
      approval_required: false,
      cashier_can_add_session_expense: false,
      cashier_max_expense_amount: null,
      allow_inventory_purchase_from_session: false,
      prevent_expenses_in_closed_periods: false,
      default_cost_center_packaging: null,
      default_cost_center_cleaning: null,
      default_cost_center_utilities: null,
    }
  );

  return (
    <div className="space-y-6">
      {canManageExpenseSettings && expenseSettings ? (
        <OperationalCard title="إعدادات المصروفات">
          <div className="grid max-w-lg gap-4">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={expenseForm.approval_required}
                onCheckedChange={(v) =>
                  setExpenseForm({ ...expenseForm, approval_required: v === true })
                }
              />
              <span className="text-sm">الموافقة على المصروف مطلوبة</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={expenseForm.cashier_can_add_session_expense}
                onCheckedChange={(v) =>
                  setExpenseForm({
                    ...expenseForm,
                    cashier_can_add_session_expense: v === true,
                  })
                }
              />
              <span className="text-sm">الكاشير يمكنه إضافة مصروف للجلسة</span>
            </label>
            <div className="space-y-2">
              <Label>أقصى مبلغ مصروف للكاشير</Label>
              <Input
                type="number"
                min={0}
                placeholder="بدون حد"
                value={expenseForm.cashier_max_expense_amount ?? ""}
                onChange={(e) =>
                  setExpenseForm({
                    ...expenseForm,
                    cashier_max_expense_amount: e.target.value
                      ? parseFloat(e.target.value)
                      : null,
                  })
                }
              />
            </div>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={expenseForm.allow_inventory_purchase_from_session}
                onCheckedChange={(v) =>
                  setExpenseForm({
                    ...expenseForm,
                    allow_inventory_purchase_from_session: v === true,
                  })
                }
              />
              <span className="text-sm">السماح بشراء مخزون من الجلسة</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={expenseForm.prevent_expenses_in_closed_periods}
                onCheckedChange={(v) =>
                  setExpenseForm({
                    ...expenseForm,
                    prevent_expenses_in_closed_periods: v === true,
                  })
                }
              />
              <span className="text-sm">منع المصروفات في الفترات المغلقة</span>
            </label>
            {(["packaging", "cleaning", "utilities"] as const).map((key) => (
              <div key={key} className="space-y-2">
                <Label>مركز التكلفة الافتراضي - {costCenterDefaultsLabels[key]}</Label>
                <select
                  className="flex h-9 w-full rounded-[var(--mds-radius-md)] border border-input bg-transparent px-3 text-sm"
                  value={
                    (expenseForm[`default_cost_center_${key}` as keyof ExpenseSettings] as string) ??
                    ""
                  }
                  onChange={(e) =>
                    setExpenseForm({
                      ...expenseForm,
                      [`default_cost_center_${key}`]: e.target.value || null,
                    })
                  }
                >
                  <option value="">لا يوجد</option>
                  {costCenters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await updateExpenseSettingsAction(expenseForm);
                    toast.success("تم حفظ إعدادات المصروفات");
                  } catch {
                    toast.error("فشل الحفظ");
                  }
                })
              }
            >
              حفظ إعدادات المصروفات
            </Button>
          </div>
        </OperationalCard>
      ) : null}

      {canManageCostCenters ? (
        costCentersPage?.activeStoreId ? (
          <CostCentersPage
            centers={costCentersPage.centers}
            categories={costCentersPage.categories}
            embedded
          />
        ) : (
          <OperationalCard title="مراكز التكلفة">
            <p className="text-sm text-muted-foreground">
              اختر فرعًا من مبدّل الفروع في أعلى الصفحة لإدارة مراكز التكلفة الخاصة به.
            </p>
          </OperationalCard>
        )
      ) : null}
    </div>
  );
}
