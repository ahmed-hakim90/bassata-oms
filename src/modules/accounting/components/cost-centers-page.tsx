"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompactAction } from "@/components/Velora/compact-actions";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { StatusPill } from "@/components/Velora/status-pill";
import {
  createCostCenterAction,
  toggleCostCenterAction,
  updateCostCenterAction,
} from "@/modules/accounting/actions/cost-center.actions";
import {
  createExpenseCategoryAction,
  toggleExpenseCategoryAction,
  updateExpenseCategoryAction,
} from "@/modules/accounting/actions/expense-category.actions";
import { COST_CENTER_TYPES } from "@/lib/constants";
import { labelCostCenterType } from "@/lib/labels/cost-centers";
import type { CostCenter, ExpenseCategory, CostCenterType } from "@/lib/types";

type ExpenseAccountOption = { id: string; code: string; name: string };

interface CostCentersPageProps {
  centers: CostCenter[];
  categories: ExpenseCategory[];
  expenseAccounts?: ExpenseAccountOption[];
  embedded?: boolean;
}

function accountLabel(account: ExpenseAccountOption) {
  return `${account.code} · ${account.name}`;
}

export function CostCentersPage({
  centers,
  categories,
  expenseAccounts = [],
  embedded,
}: CostCentersPageProps) {
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showCenterForm, setShowCenterForm] = useState(false);
  const [editCenter, setEditCenter] = useState<CostCenter | null>(null);
  const [editForm, setEditForm] = useState({ name: "", code: "", type: "other" as CostCenterType });
  const [categoryForm, setCategoryForm] = useState<string | null>(null);
  const [centerForm, setCenterForm] = useState({
    name: "",
    code: "",
    type: "other" as CostCenterType,
  });
  const [newCategory, setNewCategory] = useState({ name: "", gl_account_id: "" });

  const categoriesByCenter = categories.reduce<Record<string, ExpenseCategory[]>>((acc, c) => {
    (acc[c.cost_center_id] ??= []).push(c);
    return acc;
  }, {});

  function saveCenter() {
    startTransition(async () => {
      try {
        await createCostCenterAction(centerForm);
        toast.success("تم إنشاء مركز التكلفة");
        setShowCenterForm(false);
        setCenterForm({ name: "", code: "", type: "other" });
      } catch {
        toast.error("تعذر إنشاء مركز التكلفة");
      }
    });
  }

  function saveCategory(centerId: string) {
    startTransition(async () => {
      try {
        await createExpenseCategoryAction({
          cost_center_id: centerId,
          name: newCategory.name,
          requires_inventory_item: false,
          gl_account_id: newCategory.gl_account_id || null,
        });
        toast.success("تم إنشاء التصنيف");
        setCategoryForm(null);
        setNewCategory({ name: "", gl_account_id: "" });
      } catch {
        toast.error("تعذر إنشاء التصنيف");
      }
    });
  }

  function saveCategoryAccount(categoryId: string, accountId: string) {
    startTransition(async () => {
      try {
        await updateExpenseCategoryAction(categoryId, {
          gl_account_id: accountId || null,
        });
        toast.success("تم ربط حساب المصروف");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر ربط الحساب");
      }
    });
  }

  function openEdit(center: CostCenter) {
    setEditCenter(center);
    setEditForm({ name: center.name, code: center.code, type: center.type });
  }

  function saveEdit() {
    if (!editCenter) return;
    startTransition(async () => {
      try {
        await updateCostCenterAction(editCenter.id, editForm);
        toast.success("تم تحديث مركز التكلفة");
        setEditCenter(null);
      } catch {
        toast.error("تعذر تحديث مركز التكلفة");
      }
    });
  }

  return (
    <>
      {embedded ? (
        <div className="mb-4 flex flex-row items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">مراكز التكلفة</p>
            <p className="text-sm text-muted-foreground">
              المراكز والتصنيفات للفرع المحدد
            </p>
          </div>
          <CompactAction
            label="إضافة مركز"
            icon={Plus}
            variant="default"
            alwaysLabeled
            onClick={() => setShowCenterForm(true)}
          />
        </div>
      ) : (
        <PageHeader
          title="مراكز التكلفة"
          description="تعريف المراكز المحاسبية وتصنيفات المصروفات"
          action={
            <CompactAction
              label="إضافة مركز"
              icon={Plus}
              variant="default"
              alwaysLabeled
              onClick={() => setShowCenterForm(true)}
            />
          }
        />
      )}

      {showCenterForm && (
        <OperationalCard title="مركز تكلفة جديد" className="mb-3">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>الاسم</Label>
              <Input
                value={centerForm.name}
                onChange={(e) => setCenterForm({ ...centerForm, name: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>الكود</Label>
              <Input
                value={centerForm.code}
                onChange={(e) => setCenterForm({ ...centerForm, code: e.target.value.toUpperCase() })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>النوع</Label>
              <select
                value={centerForm.type}
                onChange={(e) =>
                  setCenterForm({ ...centerForm, type: e.target.value as CostCenterType })
                }
                className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
              >
                {COST_CENTER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {labelCostCenterType(t)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-row flex-wrap gap-2">
            <Button className="rounded-xl" disabled={pending} onClick={saveCenter}>
              حفظ
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => setShowCenterForm(false)}>
              إلغاء
            </Button>
          </div>
        </OperationalCard>
      )}

      {editCenter && (
        <OperationalCard title={`تعديل ${editCenter.name}`} className="mb-3">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>الاسم</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>الكود</Label>
              <Input
                value={editForm.code}
                onChange={(e) =>
                  setEditForm({ ...editForm, code: e.target.value.toUpperCase() })
                }
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>النوع</Label>
              <select
                value={editForm.type}
                onChange={(e) =>
                  setEditForm({ ...editForm, type: e.target.value as CostCenterType })
                }
                className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
              >
                {COST_CENTER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {labelCostCenterType(t)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-row flex-wrap gap-2">
            <Button className="rounded-xl" disabled={pending} onClick={saveEdit}>
              حفظ
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => setEditCenter(null)}>
              إلغاء
            </Button>
          </div>
        </OperationalCard>
      )}

      <div className="grid gap-4">
        {centers.map((center) => {
          const centerCategories = categoriesByCenter[center.id] ?? [];
          const isOpen = expanded[center.id] ?? true;
          return (
            <OperationalCard
              key={center.id}
              title={center.name}
              description={`${center.code} · ${labelCostCenterType(center.type)}`}
              action={
                <div className="flex items-center gap-2">
                  <StatusPill label={center.is_active ? "نشط" : "غير نشط"} variant={center.is_active ? "success" : "default"} />
                  <Button variant="ghost" size="sm" onClick={() => openEdit(center)}>
                    تعديل
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      startTransition(async () => {
                        await toggleCostCenterAction(center.id, !center.is_active);
                      })
                    }
                  >
                    تبديل
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setExpanded((e) => ({ ...e, [center.id]: !isOpen }))
                    }
                  >
                    {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </Button>
                </div>
              }
            >
              {isOpen && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">التصنيفات</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => setCategoryForm(center.id)}
                    >
                      <Plus className="mr-1 size-3" />
                      إضافة تصنيف
                    </Button>
                  </div>
                  {categoryForm === center.id && (
                    <div className="rounded-xl bg-muted/30 p-4 space-y-3">
                      <div className="space-y-2">
                        <Label>اسم التصنيف</Label>
                        <Input
                          value={newCategory.name}
                          onChange={(e) =>
                            setNewCategory({ ...newCategory, name: e.target.value })
                          }
                          className="rounded-xl"
                        />
                      </div>
                      {expenseAccounts.length > 0 ? (
                        <div className="space-y-2">
                          <Label>حساب المصروف</Label>
                          <select
                            value={newCategory.gl_account_id}
                            onChange={(e) =>
                              setNewCategory({
                                ...newCategory,
                                gl_account_id: e.target.value,
                              })
                            }
                            className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
                          >
                            <option value="">مصروفات تشغيل (افتراضي)</option>
                            {expenseAccounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {accountLabel(account)}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                      <div className="flex gap-2">
                        <Button size="sm" className="rounded-xl" disabled={pending} onClick={() => saveCategory(center.id)}>
                          حفظ
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setCategoryForm(null)}>
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  )}
                  <ul className="divide-y divide-border rounded-xl bg-card text-card-foreground ring-1 ring-border">
                    {centerCategories.length === 0 ? (
                      <li className="px-4 py-3 text-sm text-muted-foreground">لا توجد تصنيفات بعد</li>
                    ) : (
                      centerCategories.map((cat) => (
                        <li key={cat.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-medium">{cat.name}</p>
                            {cat.requires_inventory_item && (
                              <p className="text-xs text-muted-foreground">المخزون مطلوب</p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {expenseAccounts.length > 0 ? (
                              <select
                                aria-label={`حساب مصروف ${cat.name}`}
                                value={cat.gl_account_id ?? ""}
                                disabled={pending}
                                onChange={(e) => saveCategoryAccount(cat.id, e.target.value)}
                                className="flex h-9 min-w-[12rem] rounded-xl border border-input bg-transparent px-3 text-sm"
                              >
                                <option value="">مصروفات تشغيل (افتراضي)</option>
                                {expenseAccounts.map((account) => (
                                  <option key={account.id} value={account.id}>
                                    {accountLabel(account)}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                            <StatusPill label={cat.is_active ? "نشط" : "غير نشط"} variant={cat.is_active ? "success" : "default"} />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                startTransition(async () => {
                                  await toggleExpenseCategoryAction(cat.id, !cat.is_active);
                                })
                              }
                            >
                              تبديل
                            </Button>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </OperationalCard>
          );
        })}
      </div>
    </>
  );
}
