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
import {
  DEFAULT_BUSINESS_ACTIVITY_SETTINGS,
  DEFAULT_PRODUCT_TEMPLATES_BY_ACTIVITY,
  type BusinessActivitySettings,
  type ProductTemplateSettings,
} from "@/lib/constants";
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
import { ProductFormDialog } from "./product-form-dialog";
import { CategoryManagerDialog } from "./category-manager-dialog";
import { ImportProductsDialog } from "@/modules/imports-exports/components/import-products-dialog";
import {
  bulkDisableMenuInventoryTrackingAction,
  bulkSetInventoryTrackingAction,
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
  businessActivity?: BusinessActivitySettings;
  productTemplates?: ProductTemplateSettings;
  availableStockByProductId?: Record<string, number>;
  availableStockByVariantId?: Record<string, number>;
}

export function ProductsPage({
  initialProducts,
  categories,
  ingredients,
  currency,
  recipesEnabled = false,
  businessActivity = DEFAULT_BUSINESS_ACTIVITY_SETTINGS,
  productTemplates = DEFAULT_PRODUCT_TEMPLATES_BY_ACTIVITY.cafe,
  availableStockByProductId = {},
  availableStockByVariantId = {},
}: ProductsPageProps) {
  const router = useRouter();
  const isSupermarket = businessActivity.activity_type === "supermarket";
  const showIngredientsCatalog = !isSupermarket && recipesEnabled;
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [view, setView] = useState<CatalogView>("menu");
  const [layout, setLayout] = useState<LayoutView>("table");
  const [cafeDialogOpen, setCafeDialogOpen] = useState(false);
  const [retailDialogOpen, setRetailDialogOpen] = useState(false);
  const [ingredientDialogOpen, setIngredientDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [editingVariants, setEditingVariants] = useState<ProductVariant[]>([]);
  const [editingIngredient, setEditingIngredient] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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

  const visibleSource =
    showIngredientsCatalog && view === "ingredients" ? ingredientItems : menuItems;

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
    if (isSupermarket) {
      setRetailDialogOpen(true);
      return;
    }
    setCafeDialogOpen(true);
  }

  function openCreateIngredient() {
    setEditingIngredient(null);
    setIngredientDialogOpen(true);
  }

  function openEdit(item: ProductGridItem) {
    setEditing(item.product);
    setEditingVariants(item.variants ?? []);
    if (isSupermarket) {
      setRetailDialogOpen(true);
      return;
    }
    setCafeDialogOpen(true);
  }

  function openEditIngredient(item: ProductGridItem) {
    setEditingIngredient(item.product);
    setIngredientDialogOpen(true);
  }

  function handleDelete(product: Product) {
    if (!confirm(`حذف ${product.name}؟`)) return;
    startTransition(async () => {
      const result = await deleteProductAction(product.id);
      if (result.ok) {
        toast.success("تم حذف المنتج");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleBulkDisableTracking() {
    if (
      !confirm(
        isSupermarket
          ? "سيتم تفعيل كل منتجات البيع وجعلها غير متتبعة للمخزون. هل تريد المتابعة؟"
          : "سيتم تفعيل كل أصناف المنيو وجعلها غير متتبعة للمخزون. المكونات لن تتأثر. هل تريد المتابعة؟"
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await bulkDisableMenuInventoryTrackingAction();
        toast.success(
          isSupermarket
            ? `تم تحديث ${result.count} منتج`
            : `تم تحديث ${result.count} صنف منيو`
        );
        setSelectedIds([]);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر تحديث الأصناف");
      }
    });
  }

  function handleBulkTracking(trackInventory: boolean, scope: "selection" | "category") {
    if (scope === "category" && !categoryId) {
      toast.error("اختَر تصنيفًا من القائمة الجانبية أولًا");
      return;
    }
    if (scope === "selection" && selectedIds.length === 0) {
      toast.error("حدّد منتجات من الجدول أولًا");
      return;
    }

    const categoryName =
      categoryList.find((category) => category.id === categoryId)?.name ?? "التصنيف";
    const confirmMessage =
      scope === "category"
        ? trackInventory
          ? `تفعيل تتبع المخزون لكل منتجات «${categoryName}»؟`
          : `إيقاف تتبع المخزون لكل منتجات «${categoryName}»؟`
        : trackInventory
          ? `تفعيل تتبع المخزون لـ ${selectedIds.length} منتج؟`
          : `إيقاف تتبع المخزون لـ ${selectedIds.length} منتج؟`;

    if (!confirm(confirmMessage)) return;

    startTransition(async () => {
      try {
        const result = await bulkSetInventoryTrackingAction(
          scope === "category"
            ? { trackInventory, categoryId }
            : { trackInventory, productIds: selectedIds }
        );
        toast.success(
          trackInventory
            ? `تم تفعيل التتبع لـ ${result.count} منتج`
            : `تم إيقاف التتبع لـ ${result.count} منتج`
        );
        setSelectedIds([]);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر تحديث التتبع");
      }
    });
  }

  const inventoryToolbar =
    layout === "table" && (selectedIds.length > 0 || Boolean(categoryId)) ? (
      <div className="flex flex-wrap items-center gap-2">
        {selectedIds.length > 0 ? (
          <>
            <span className="text-xs text-muted-foreground">{selectedIds.length} محدد</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => handleBulkTracking(true, "selection")}
            >
              تفعيل التتبع
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => handleBulkTracking(false, "selection")}
            >
              إيقاف التتبع
            </Button>
          </>
        ) : null}
        {categoryId ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => handleBulkTracking(true, "category")}
            >
              تفعيل التصنيف كامل
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => handleBulkTracking(false, "category")}
            >
              إيقاف التصنيف كامل
            </Button>
          </>
        ) : null}
      </div>
    ) : null;

  const emptyAction =
    showIngredientsCatalog && view === "ingredients" ? (
      <Button type="button" onClick={openCreateIngredient}>
        <Plus className="size-4" />
        مكوّن جديد
      </Button>
    ) : (
      <Button type="button" onClick={openCreate}>
        <Plus className="size-4" />
        {isSupermarket ? "منتج جديد" : "صنف منيو جديد"}
      </Button>
    );

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]">
      <PageHeader
        breadcrumb={<span>المخزون · المنتجات</span>}
        title="المنتجات"
        description={
          isSupermarket
            ? "كتالوج البيع، الباركود، سعر الشراء وسعر البيع — تجهيز الكاشير والمخزون."
            : "كتالوج المنيو والأسعار والتصنيفات — المكان اللي بتجهّز منه الكاشير."
        }
        action={
          <>
            <Button type="button" onClick={openCreate} className="shadow-[var(--mds-elevation-1)]">
              <Plus className="size-4" />
              {isSupermarket ? "منتج جديد" : "صنف منيو جديد"}
            </Button>
            {showIngredientsCatalog ? (
              <Button type="button" variant="outline" onClick={openCreateIngredient}>
                <Plus className="size-4" />
                مكوّن جديد
              </Button>
            ) : null}
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

      <div className={`grid gap-[var(--mds-space-3)] ${showIngredientsCatalog ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <OperationalCard
          title={isSupermarket ? "المنتجات النشطة" : "الأصناف النشطة"}
          value={String(activeCount)}
          subtitle={`من أصل ${menuItems.length} ${isSupermarket ? "منتج" : "صنف منيو"}`}
        />
        <OperationalCard
          title="شائعة في الكاشير"
          value={String(popularCount)}
          subtitle="تظهر أولاً في نقطة البيع"
          accent="var(--mds-color-feedback-info)"
        />
        {showIngredientsCatalog ? (
          <OperationalCard
            title="المكونات"
            value={String(ingredientItems.length)}
            subtitle="للوصفات والمخزون"
            accent="var(--mds-color-feedback-success)"
          />
        ) : null}
      </div>

      <div className="grid gap-[var(--mds-space-4)] lg:grid-cols-[240px_minmax(0,1fr)]">
        <CategoryList
          categories={categoryList}
          selectedId={categoryId}
          counts={counts}
          onSelect={(id) => {
            setCategoryId(id);
            setSelectedIds([]);
          }}
        />

        <div className="flex min-w-0 flex-col gap-[var(--mds-space-4)]">
          <div className="flex flex-col gap-[var(--mds-space-3)] rounded-[var(--mds-radius-lg)] border border-border bg-card p-[var(--mds-space-3)] shadow-[var(--mds-elevation-1)] sm:flex-row sm:items-center sm:justify-between">
            {showIngredientsCatalog ? (
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
                    setSelectedIds([]);
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
                    setSelectedIds([]);
                  }}
                >
                  المكونات
                </button>
              </div>
            ) : (
              <p className="text-sm font-medium text-foreground">
                {isSupermarket ? "منتجات البيع" : "أصناف المنيو"}
              </p>
            )}

            <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-lg sm:justify-end">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 border-border/70 bg-background pe-3 ps-9"
                  placeholder={
                    showIngredientsCatalog && view === "ingredients"
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
              {layout === "table"
                ? " · عدّل السعر والحالة وتتبع المخزون مباشرة من الجدول"
                : ""}
            </span>
            {pending ? <span>جاري التحديث…</span> : null}
          </div>

          {layout === "table" ? (
            <ProductTable
              items={filtered}
              currency={currency}
              supermarketColumns={isSupermarket}
              priceMode={
                showIngredientsCatalog && view === "ingredients" ? "cost" : "sale"
              }
              availableStockByProductId={availableStockByProductId}
              availableStockByVariantId={availableStockByVariantId}
              selectedIds={selectedIds}
              onSelectedIdsChange={setSelectedIds}
              toolbar={inventoryToolbar}
              onEdit={
                showIngredientsCatalog && view === "ingredients"
                  ? openEditIngredient
                  : openEdit
              }
              onDelete={handleDelete}
              emptyAction={emptyAction}
            />
          ) : (
            <ProductGrid
              items={filtered}
              currency={currency}
              priceMode={
                showIngredientsCatalog && view === "ingredients" ? "cost" : "sale"
              }
              availableStockByProductId={availableStockByProductId}
              availableStockByVariantId={availableStockByVariantId}
              onEdit={
                showIngredientsCatalog && view === "ingredients"
                  ? openEditIngredient
                  : openEdit
              }
              onDelete={handleDelete}
              emptyAction={emptyAction}
            />
          )}
        </div>
      </div>

      {isSupermarket ? (
        <ProductFormDialog
          open={retailDialogOpen}
          onOpenChange={setRetailDialogOpen}
          categories={categoryList}
          product={editing}
          recipesEnabled={false}
          productTemplates={productTemplates}
          businessActivitySettings={businessActivity}
          currency={currency}
          existingSkus={existingSkus}
          onSaved={() => router.refresh()}
        />
      ) : (
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
      )}

      {showIngredientsCatalog ? (
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
      ) : null}

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
        activityType={businessActivity.activity_type}
      />
    </div>
  );
}
