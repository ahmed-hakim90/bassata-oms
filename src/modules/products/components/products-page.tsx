"use client";

import { useMemo, useState, useTransition } from "react";
import {
  FileSpreadsheet,
  LayoutGrid,
  List,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Tags,
} from "lucide-react";
import type { Product, ProductVariant } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { ProductGrid, type ProductGridItem } from "./product-grid";
import { ProductTable } from "./product-table";
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
import { cn } from "@/lib/utils";

type CatalogView = "menu" | "ingredients";
type LayoutView = "grid" | "table";

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
  const [layout, setLayout] = useState<LayoutView>("table");
  const [cafeDialogOpen, setCafeDialogOpen] = useState(false);
  const [ingredientDialogOpen, setIngredientDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [editingVariants, setEditingVariants] = useState<ProductVariant[]>([]);
  const [editingIngredient, setEditingIngredient] = useState<Product | null>(null);
  const [pending, startTransition] = useTransition();

  const categoryList = categories.filter((c): c is NonNullable<typeof c> => c !== null);

  const existingSkus = useMemo(
    () => initialProducts.map(({ product }) => product.sku),
    [initialProducts]
  );

  const menuItems = useMemo(
    () => initialProducts.filter(({ product }) => product.product_type !== "ingredient"),
    [initialProducts]
  );

  const ingredientItems = useMemo(
    () => initialProducts.filter(({ product }) => product.product_type === "ingredient"),
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
    setEditingVariants([]);
    setCafeDialogOpen(true);
  }

  function openCreateIngredient() {
    setEditingIngredient(null);
    setIngredientDialogOpen(true);
  }

  function openEdit(item: ProductGridItem) {
    setEditing(item.product);
    setEditingVariants(item.variants ?? []);
    setCafeDialogOpen(true);
  }

  function openEditIngredient(item: ProductGridItem) {
    setEditingIngredient(item.product);
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

  const emptyAction =
    view === "ingredients" ? (
      <Button type="button" onClick={openCreateIngredient}>
        <Plus className="size-4" />
        مكوّن جديد
      </Button>
    ) : (
      <Button type="button" onClick={openCreate}>
        <Plus className="size-4" />
        صنف منيو جديد
      </Button>
    );

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]">
      <PageHeader
        breadcrumb={<span>المخزون · المنتجات</span>}
        title="المنتجات"
        description="كتالوج المنيو والأسعار والتصنيفات — المكان اللي بتجهّز منه الكاشير."
        action={
          <>
            <Button type="button" onClick={openCreate} className="shadow-[var(--mds-elevation-1)]">
              <Plus className="size-4" />
              صنف منيو جديد
            </Button>
            <Button type="button" variant="outline" onClick={openCreateIngredient}>
              <Plus className="size-4" />
              مكوّن جديد
            </Button>
            <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(true)}>
              <Tags className="size-4" />
              التصنيفات
            </Button>
            <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="size-4" />
              استيراد / تصدير
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button type="button" variant="outline" size="icon" aria-label="المزيد" />
                }
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                <DropdownMenuItem
                  variant="destructive"
                  disabled={pending}
                  onClick={handleBulkDisableTracking}
                >
                  <Package className="size-4" />
                  تفعيل وإلغاء تتبع المخزون
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="grid gap-[var(--mds-space-3)] sm:grid-cols-3">
        <OperationalCard
          title="الأصناف النشطة"
          value={String(activeCount)}
          subtitle={`من أصل ${menuItems.length} صنف منيو`}
        />
        <OperationalCard
          title="شائعة في الكاشير"
          value={String(popularCount)}
          subtitle="تظهر أولاً في نقطة البيع"
          accent="var(--mds-color-feedback-info)"
        />
        <OperationalCard
          title="المكونات"
          value={String(ingredientItems.length)}
          subtitle="للوصفات والمخزون"
          accent="var(--mds-color-feedback-success)"
        />
      </div>

      <div className="grid gap-[var(--mds-space-4)] lg:grid-cols-[240px_minmax(0,1fr)]">
        <CategoryList
          categories={categoryList}
          selectedId={categoryId}
          counts={counts}
          onSelect={setCategoryId}
        />

        <div className="flex min-w-0 flex-col gap-[var(--mds-space-4)]">
          <div className="flex flex-col gap-[var(--mds-space-3)] rounded-[var(--mds-radius-lg)] border border-border bg-card p-[var(--mds-space-3)] shadow-[var(--mds-elevation-1)] sm:flex-row sm:items-center sm:justify-between">
            <div
              className="inline-flex rounded-[var(--mds-radius-md)] bg-muted/60 p-1"
              role="tablist"
              aria-label="نوع الكتالوج"
            >
              <button
                type="button"
                role="tab"
                aria-selected={view === "menu"}
                className={cn(
                  "rounded-[var(--mds-radius-sm)] px-3 py-1.5 text-sm transition-colors",
                  view === "menu"
                    ? "bg-card font-semibold text-foreground shadow-[var(--mds-elevation-1)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => {
                  setView("menu");
                  setCategoryId(null);
                }}
              >
                أصناف المنيو
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "ingredients"}
                className={cn(
                  "rounded-[var(--mds-radius-sm)] px-3 py-1.5 text-sm transition-colors",
                  view === "ingredients"
                    ? "bg-card font-semibold text-foreground shadow-[var(--mds-elevation-1)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => {
                  setView("ingredients");
                  setCategoryId(null);
                }}
              >
                المكونات
              </button>
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-lg sm:justify-end">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 border-border/70 bg-background pe-3 ps-9"
                  placeholder={
                    view === "ingredients"
                      ? "ابحث في المكونات بالاسم أو الكود…"
                      : "ابحث بالاسم أو الكود أو الباركود…"
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="بحث المنتجات"
                />
              </div>
              <div
                className="inline-flex shrink-0 rounded-[var(--mds-radius-md)] bg-muted/60 p-1"
                role="group"
                aria-label="شكل العرض"
              >
                <button
                  type="button"
                  className={cn(
                    "rounded-[var(--mds-radius-sm)] p-2 transition-colors",
                    layout === "table"
                      ? "bg-card text-foreground shadow-[var(--mds-elevation-1)]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-pressed={layout === "table"}
                  aria-label="عرض جدول"
                  onClick={() => setLayout("table")}
                >
                  <List className="size-4" />
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-[var(--mds-radius-sm)] p-2 transition-colors",
                    layout === "grid"
                      ? "bg-card text-foreground shadow-[var(--mds-elevation-1)]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-pressed={layout === "grid"}
                  aria-label="عرض كروت"
                  onClick={() => setLayout("grid")}
                >
                  <LayoutGrid className="size-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              عرض {filtered.length} من {visibleSource.length}
              {categoryId ? " · تصنيف محدد" : ""}
              {layout === "table" ? " · عدّل السعر مباشرة من الجدول" : ""}
            </span>
            {pending ? <span>جاري التحديث…</span> : null}
          </div>

          {layout === "table" ? (
            <ProductTable
              items={filtered}
              currency={currency}
              priceMode={view === "ingredients" ? "cost" : "sale"}
              onEdit={view === "ingredients" ? openEditIngredient : openEdit}
              onDelete={handleDelete}
              emptyAction={emptyAction}
            />
          ) : (
            <ProductGrid
              items={filtered}
              currency={currency}
              priceMode={view === "ingredients" ? "cost" : "sale"}
              onEdit={view === "ingredients" ? openEditIngredient : openEdit}
              onDelete={handleDelete}
              emptyAction={emptyAction}
            />
          )}
        </div>
      </div>

      <CafeMenuItemDialog
        open={cafeDialogOpen}
        onOpenChange={setCafeDialogOpen}
        categories={categoryList}
        ingredients={ingredients}
        product={editing}
        initialVariants={editingVariants}
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
