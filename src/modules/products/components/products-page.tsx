"use client";

import { useMemo, useState, useTransition } from "react";
import { FileSpreadsheet, Plus, Search, Tags } from "lucide-react";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassPanel } from "@/components/SweetFlow/glass-panel";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { ProductGrid, type ProductGridItem } from "./product-grid";
import { CategoryList } from "./category-list";
import { CafeMenuItemDialog } from "./cafe-menu-item-dialog";
import { CafeIngredientDialog } from "./cafe-ingredient-dialog";
import { CategoryManagerDialog } from "./category-manager-dialog";
import { ImportProductsDialog } from "@/modules/imports-exports/components/import-products-dialog";
import {
  bulkDisableMenuInventoryTrackingAction,
  deleteProductAction,
} from "../actions/product.actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type CatalogView = "menu" | "ingredients";

interface ProductsPageProps {
  initialProducts: (ProductGridItem & { hasRecipe?: boolean })[];
  categories: ProductGridItem["category"][];
  ingredients: Product[];
  currency: string;
  recipesEnabled?: boolean;
}

export function ProductsPage({
  initialProducts,
  categories,
  ingredients,
  currency,
  recipesEnabled = false,
}: ProductsPageProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [view, setView] = useState<CatalogView>("menu");
  const [cafeDialogOpen, setCafeDialogOpen] = useState(false);
  const [ingredientDialogOpen, setIngredientDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [editingIngredient, setEditingIngredient] = useState<Product | null>(null);
  const [pending, startTransition] = useTransition();

  const categoryList = categories.filter((c): c is NonNullable<typeof c> => c !== null);

  const existingSkus = useMemo(
    () => initialProducts.map(({ product }) => product.sku),
    [initialProducts]
  );

  const menuItems = useMemo(
    () =>
      initialProducts.filter(({ product }) => product.product_type !== "ingredient"),
    [initialProducts]
  );

  const ingredientItems = useMemo(
    () =>
      initialProducts.filter(({ product }) => product.product_type === "ingredient"),
    [initialProducts]
  );

  const visibleSource = view === "ingredients" ? ingredientItems : menuItems;

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const { product } of visibleSource) {
      map[product.category_id] = (map[product.category_id] ?? 0) + 1;
    }
    return map;
  }, [visibleSource]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleSource.filter(({ product }) => {
      if (categoryId && product.category_id !== categoryId) return false;
      if (!q) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q) ||
        product.barcode.includes(q)
      );
    });
  }, [visibleSource, categoryId, search]);

  const activeCount = menuItems.filter((p) => p.product.is_active).length;
  const popularCount = menuItems.filter((p) => p.product.is_popular).length;

  function openCreate() {
    setEditing(null);
    setCafeDialogOpen(true);
  }

  function openCreateIngredient() {
    setEditingIngredient(null);
    setIngredientDialogOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setCafeDialogOpen(true);
  }

  function openEditIngredient(product: Product) {
    setEditingIngredient(product);
    setIngredientDialogOpen(true);
  }

  function handleDelete(product: Product) {
    if (!confirm(`حذف ${product.name}؟`)) return;
    startTransition(async () => {
      try {
        const ok = await deleteProductAction(product.id);
        if (ok) {
          toast.success("تم حذف المنتج");
          router.refresh();
        } else {
          toast.error("تعذر حذف المنتج");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر حذف المنتج");
      }
    });
  }

  function handleBulkDisableTracking() {
    if (
      !confirm(
        "سيتم تفعيل كل أصناف المنيو وجعلها غير متتبعة للمخزون. المكونات لن تتأثر. هل تريد المتابعة؟"
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await bulkDisableMenuInventoryTrackingAction();
        toast.success(`تم تحديث ${result.count} صنف منيو`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر تحديث الأصناف");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">المنتجات</h1>
          <p className="text-sm text-muted-foreground">
            كتالوج المنيو والأسعار وتنظيم التصنيفات.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={pending} onClick={handleBulkDisableTracking}>
            تفعيل الأصناف وإلغاء تتبع المخزون
          </Button>
          <Button variant="outline" onClick={() => setCategoryDialogOpen(true)}>
            <Tags className="size-4" />
            التصنيفات
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="size-4" />
            استيراد
          </Button>
          <Button variant="outline" onClick={openCreateIngredient}>
            <Plus className="size-4" />
            مكوّن جديد
          </Button>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            صنف منيو جديد
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <OperationalCard
          title="الأصناف النشطة"
          value={String(activeCount)}
          subtitle={`${menuItems.length} صنف منيو`}
          accent="#2563EB"
        />
        <OperationalCard
          title="اختيارات شائعة"
          value={String(popularCount)}
          subtitle="ظاهرة في كروت الكاشير"
          accent="#F472B6"
        />
        <OperationalCard
          title="المكونات"
          value={String(ingredientItems.length)}
          subtitle="تستخدم في الوصفات والمخزون"
          accent="#34D399"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <CategoryList
          categories={categoryList}
          selectedId={categoryId}
          counts={counts}
          onSelect={setCategoryId}
        />

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={view === "menu" ? "secondary" : "outline"}
              onClick={() => {
                setView("menu");
                setCategoryId(null);
              }}
            >
              أصناف المنيو
            </Button>
            <Button
              variant={view === "ingredients" ? "secondary" : "outline"}
              onClick={() => {
                setView("ingredients");
                setCategoryId(null);
              }}
            >
              المكونات
            </Button>
          </div>

          <GlassPanel className="flex items-center gap-2 p-2">
            <Search className="ml-2 size-4 text-muted-foreground" />
            <Input
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              placeholder={
                view === "ingredients"
                  ? "ابحث في المكونات بالاسم أو الكود…"
                  : "ابحث بالاسم أو الكود أو الباركود…"
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </GlassPanel>

          <ProductGrid
            items={filtered}
            currency={currency}
            priceMode={view === "ingredients" ? "cost" : "sale"}
            onEdit={view === "ingredients" ? openEditIngredient : openEdit}
            onDelete={handleDelete}
          />
          {pending ? (
            <p className="text-center text-xs text-muted-foreground">جاري التحديث…</p>
          ) : null}
        </div>
      </div>

      <CafeMenuItemDialog
        open={cafeDialogOpen}
        onOpenChange={setCafeDialogOpen}
        categories={categoryList}
        ingredients={ingredients}
        product={editing}
        recipesEnabled={recipesEnabled}
        currency={currency}
        existingSkus={existingSkus}
        onSaved={() => router.refresh()}
      />

      <CafeIngredientDialog
        key={editingIngredient?.id ?? "new-ingredient"}
        open={ingredientDialogOpen}
        onOpenChange={(nextOpen) => {
          setIngredientDialogOpen(nextOpen);
          if (!nextOpen) setEditingIngredient(null);
        }}
        categories={categoryList}
        ingredient={editingIngredient}
        onSaved={() => router.refresh()}
      />

      <CategoryManagerDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        categories={categoryList}
        counts={counts}
        onSaved={() => router.refresh()}
      />

      <ImportProductsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => router.refresh()}
      />
    </div>
  );
}
