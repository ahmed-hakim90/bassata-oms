"use client";

import { useMemo, useState, useTransition } from "react";
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
  if (!name) throw new Error("Category name is required");
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
  const [pending, startTransition] = useTransition();

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [categories]
  );

  const isEditing = Boolean(editingId);

  function resetForm() {
    setForm(DEFAULT_FORM);
    setEditingId(null);
  }

  function editCategory(category: Category) {
    setEditingId(category.id);
    setForm(toForm(category));
  }

  function submit() {
    startTransition(async () => {
      try {
        const payload = buildPayload(form);
        if (editingId) {
          await updateCategoryAction(editingId, payload);
          toast.success("Category updated");
        } else {
          await createCategoryAction(payload);
          toast.success("Category created");
        }
        resetForm();
        onSaved?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save category");
      }
    });
  }

  function removeCategory(category: Category) {
    const productCount = counts[category.id] ?? 0;
    const message =
      productCount > 0
        ? `Delete ${category.name}? It is used by ${productCount} products.`
        : `Delete ${category.name}?`;
    if (!confirm(message)) return;

    startTransition(async () => {
      try {
        await deleteCategoryAction(category.id);
        if (editingId === category.id) resetForm();
        toast.success("Category deleted");
        onSaved?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not delete category");
      }
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <StandardModalContent
        size="lg"
        title="Manage categories"
        description="Create, reorder, and style product categories."
      >
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Desserts"
              />
            </div>

            <div className="grid grid-cols-[1fr_88px] gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="category-icon">Icon</Label>
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
                <Label htmlFor="category-sort">Order</Label>
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
              <Label htmlFor="category-color">Color</Label>
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
              <Button className="flex-1" onClick={submit} disabled={pending}>
                {isEditing ? <Save className="size-4" /> : <Plus className="size-4" />}
                {isEditing ? "Save" : "Add"}
              </Button>
              {isEditing ? (
                <Button variant="outline" size="icon" onClick={resetForm} disabled={pending}>
                  <X className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="min-h-[260px] space-y-2">
            {sortedCategories.length === 0 ? (
              <div className="flex h-full min-h-[220px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                No categories yet
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
                      {counts[category.id] ?? 0} products · order {category.sort_order}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => editCategory(category)}
                    disabled={pending}
                  >
                    <Edit2 className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeCategory(category)}
                    disabled={pending}
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
