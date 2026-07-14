"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Edit2, Plus, Save, Trash2, X } from "lucide-react";
import type { Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StandardModalContent } from "@/components/SweetFlow/standard-modal";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/modules/products/actions/product.actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type CategoryFormState = {
  name: string;
  color: string;
  icon: string;
  sort_order: string;
};

interface CategoryManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  counts: Record<string, number>;
  onSaved?: () => void;
}

const DEFAULT_FORM: CategoryFormState = {
  name: "",
  color: "#34D399",
  icon: "tag",
  sort_order: "0",
};

function toForm(category: Category): CategoryFormState {
  return {
    name: category.name,
    color: category.color || DEFAULT_FORM.color,
    icon: category.icon || DEFAULT_FORM.icon,
    sort_order: String(category.sort_order ?? 0),
  };
}

function buildPayload(form: CategoryFormState) {
  const name = form.name.trim();
  if (!name) throw new Error("اسم التصنيف مطلوب");
  return {
    name,
    color: form.color || DEFAULT_FORM.color,
    icon: form.icon.trim() || DEFAULT_FORM.icon,
    sort_order: Number(form.sort_order) || 0,
  };
}

export function CategoryManagerDialog({
  open,
  onOpenChange,
  categories,
  counts,
  onSaved,
}: CategoryManagerDialogProps) {
  const [form, setForm] = useState<CategoryFormState>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localCategories, setLocalCategories] = useState(categories);
  const [dirty, setDirty] = useState(false);
  const snapshotRef = useRef<Category[] | null>(null);
  const cancelledTempIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (open) {
      setLocalCategories(categories);
      setDirty(false);
    }
  }, [open, categories]);

  const sortedCategories = useMemo(
    () =>
      [...localCategories].sort(
        (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
      ),
    [localCategories]
  );

  const isEditing = Boolean(editingId);

  function resetForm() {
    setForm(DEFAULT_FORM);
    setEditingId(null);
  }

  function editCategory(category: Category) {
    if (category.id.startsWith("temp-")) return;
    setEditingId(category.id);
    setForm(toForm(category));
  }

  function submit() {
    let payload: ReturnType<typeof buildPayload>;
    try {
      payload = buildPayload(form);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ التصنيف");
      return;
    }

    if (editingId) {
      snapshotRef.current = localCategories;
      setLocalCategories((prev) =>
        prev.map((category) =>
          category.id === editingId ? { ...category, ...payload } : category
        )
      );
      setDirty(true);
      resetForm();

      void (async () => {
        try {
          const updated = await updateCategoryAction(editingId, payload);
          if (!updated) throw new Error("التصنيف غير موجود");
          setLocalCategories((prev) =>
            prev.map((category) => (category.id === editingId ? updated : category))
          );
        } catch (error) {
          if (snapshotRef.current) setLocalCategories(snapshotRef.current);
          toast.error(error instanceof Error ? error.message : "تعذر حفظ التصنيف");
        }
      })();
      return;
    }

    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: Category = {
      id: tempId,
      org_id: "",
      name: payload.name,
      color: payload.color,
      icon: payload.icon,
      sort_order: payload.sort_order,
    };
    snapshotRef.current = localCategories;
    setLocalCategories((prev) => [...prev, optimistic]);
    setDirty(true);
    resetForm();

    void (async () => {
      try {
        const created = await createCategoryAction(payload);
        if (cancelledTempIdsRef.current.has(tempId)) {
          cancelledTempIdsRef.current.delete(tempId);
          try {
            await deleteCategoryAction(created.id);
          } catch {
            /* best-effort */
          }
          return;
        }
        setLocalCategories((prev) => {
          const withoutTemp = prev.filter((category) => category.id !== tempId);
          if (withoutTemp.some((category) => category.id === created.id)) {
            return withoutTemp;
          }
          return [...withoutTemp, created];
        });
      } catch (error) {
        if (snapshotRef.current) setLocalCategories(snapshotRef.current);
        toast.error(error instanceof Error ? error.message : "تعذر حفظ التصنيف");
      }
    })();
  }

  function removeCategory(category: Category) {
    const productCount = counts[category.id] ?? 0;
    const message =
      productCount > 0
        ? `حذف «${category.name}»؟ مستخدم في ${productCount} منتج.`
        : `حذف «${category.name}»؟`;
    if (!confirm(message)) return;

    snapshotRef.current = localCategories;
    setLocalCategories((prev) => prev.filter((row) => row.id !== category.id));
    setDirty(true);
    if (editingId === category.id) resetForm();

    if (category.id.startsWith("temp-")) {
      cancelledTempIdsRef.current.add(category.id);
      return;
    }

    void (async () => {
      try {
        await deleteCategoryAction(category.id);
      } catch (error) {
        if (snapshotRef.current) setLocalCategories(snapshotRef.current);
        toast.error(error instanceof Error ? error.message : "تعذر حذف التصنيف");
      }
    })();
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetForm();
      if (dirty) onSaved?.();
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <StandardModalContent
        size="lg"
        title="إدارة التصنيفات"
        description="أنشئ ورتّب وصمّم تصنيفات المنتجات."
      >
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="category-name">الاسم</Label>
              <Input
                id="category-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="حلويات"
              />
            </div>

            <div className="grid grid-cols-[1fr_88px] gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="category-icon">أيقونة</Label>
                <Input
                  id="category-icon"
                  value={form.icon}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, icon: event.target.value }))
                  }
                  placeholder="tag"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category-sort">الترتيب</Label>
                <Input
                  id="category-sort"
                  type="number"
                  value={form.sort_order}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, sort_order: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category-color">اللون</Label>
              <div className="grid grid-cols-[42px_1fr] gap-2">
                <Input
                  id="category-color"
                  type="color"
                  className="h-8 p-1"
                  value={form.color}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, color: event.target.value }))
                  }
                />
                <Input
                  value={form.color}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, color: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={submit}>
                {isEditing ? <Save className="size-4" /> : <Plus className="size-4" />}
                {isEditing ? "حفظ" : "إضافة"}
              </Button>
              {isEditing ? (
                <Button variant="outline" size="icon" onClick={resetForm}>
                  <X className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="min-h-[260px] space-y-2">
            {sortedCategories.length === 0 ? (
              <div className="flex h-full min-h-[220px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                مفيش تصنيفات لسة
              </div>
            ) : (
              sortedCategories.map((category) => (
                <div
                  key={category.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border bg-card p-3",
                    editingId === category.id && "ring-2 ring-ring/30"
                  )}
                >
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{category.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {counts[category.id] ?? 0} منتج · ترتيب {category.sort_order}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => editCategory(category)}
                    disabled={category.id.startsWith("temp-")}
                  >
                    <Edit2 className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeCategory(category)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </StandardModalContent>
    </Dialog>
  );
}
