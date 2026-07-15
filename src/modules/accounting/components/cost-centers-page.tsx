"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import {
  createCostCenterAction,
  toggleCostCenterAction,
  updateCostCenterAction,
} from "@/modules/accounting/actions/cost-center.actions";
import {
  createExpenseCategoryAction,
  toggleExpenseCategoryAction,
} from "@/modules/accounting/actions/expense-category.actions";
import { COST_CENTER_TYPES } from "@/lib/constants";
import { labelCostCenterType } from "@/lib/labels/cost-centers";
import type { CostCenter, ExpenseCategory, CostCenterType } from "@/lib/types";

interface CostCentersPageProps {
  centers: CostCenter[];
  categories: ExpenseCategory[];
  embedded?: boolean;
}

export function CostCentersPage({ centers, categories, embedded }: CostCentersPageProps) {
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
  const [newCategory, setNewCategory] = useState({ name: "", requires_inventory_item: false });

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
        });
        toast.success("تم إنشاء التصنيف");
        setCategoryForm(null);
        setNewCategory({ name: "", requires_inventory_item: false });
      } catch {
        toast.error("تعذر إنشاء التصنيف");
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
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-medium">مراكز التكلفة</p>
            <p className="text-sm text-muted-foreground">
              المراكز والتصنيفات للفرع المحدد
            </p>
          </div>
          <Button className="w-full rounded-xl sm:w-auto" onClick={() => setShowCenterForm(true)}>
            <Plus className="mr-2 size-4" />
            إضافة مركز
          </Button>
        </div>
      ) : (
        <PageHeader
          title="مراكز التكلفة"
          description="تعريف المراكز المحاسبية وتصنيفات المصروفات"
          action={
            <Button className="rounded-xl" onClick={() => setShowCenterForm(true)}>
              <Plus className="mr-2 size-4" />
              إضافة مركز
            </Button>
          }
        />
      )}

      {showCenterForm && (
        <OperationalCard title="مركز تكلفة جديد" className="mb-6">
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
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
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
        <OperationalCard title={`تعديل ${editCenter.name}`} className="mb-6">
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
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
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
                      <Input
                        placeholder="اسم التصنيف"
                        value={newCategory.name}
                        onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                        className="rounded-xl"
                      />
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
                        <li key={cat.id} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="font-medium">{cat.name}</p>
                            {cat.requires_inventory_item && (
                              <p className="text-xs text-muted-foreground">المخزون مطلوب</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
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
