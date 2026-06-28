"use client";

import { useMemo, useState, useTransition } from "react";
import { FileSpreadsheet, Plus, Search } from "lucide-react";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassPanel } from "@/components/SweetFlow/glass-panel";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { ProductGrid, type ProductGridItem } from "./product-grid";
import { CategoryList } from "./category-list";
import { CafeMenuItemDialog } from "./cafe-menu-item-dialog";
import { CafeIngredientDialog } from "./cafe-ingredient-dialog";
import { ImportProductsDialog } from "@/modules/imports-exports/components/import-products-dialog";
import { deleteProductAction } from "../actions/product.actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
  const [cafeDialogOpen, setCafeDialogOpen] = useState(false);
  const [ingredientDialogOpen, setIngredientDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [pending, startTransition] = useTransition();

  const categoryList = categories.filter((c): c is NonNullable<typeof c> => c !== null);

  const existingSkus = useMemo(
    () => initialProducts.map(({ product }) => product.sku),
    [initialProducts]
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const { product } of initialProducts) {
      map[product.category_id] = (map[product.category_id] ?? 0) + 1;
    }
    return map;
  }, [initialProducts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialProducts.filter(({ product }) => {
      if (categoryId && product.category_id !== categoryId) return false;
      if (!q) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q) ||
        product.barcode.includes(q)
      );
    });
  }, [initialProducts, categoryId, search]);

  const activeCount = initialProducts.filter((p) => p.product.is_active).length;
  const popularCount = initialProducts.filter((p) => p.product.is_popular).length;

  function openCreate() {
    setEditing(null);
    setCafeDialogOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setCafeDialogOpen(true);
  }

  function handleDelete(product: Product) {
    if (!confirm(`Remove ${product.name}?`)) return;
    startTransition(async () => {
      try {
        const ok = await deleteProductAction(product.id);
        if (ok) {
          toast.success("Product removed");
          router.refresh();
        } else {
          toast.error("Could not remove product");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not remove product");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            Menu catalog, pricing, and category organization.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="size-4" />
            Import
          </Button>
          <Button variant="outline" onClick={() => setIngredientDialogOpen(true)}>
            <Plus className="size-4" />
            New ingredient
          </Button>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New menu item
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <OperationalCard
          title="Active items"
          value={String(activeCount)}
          subtitle={`${initialProducts.length} total SKUs`}
          accent="#2563EB"
        />
        <OperationalCard
          title="Popular picks"
          value={String(popularCount)}
          subtitle="Featured on POS tiles"
          accent="#F472B6"
        />
        <OperationalCard
          title="Categories"
          value={String(categoryList.length)}
          subtitle="Organized menu groups"
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
          <GlassPanel className="flex items-center gap-2 p-2">
            <Search className="ml-2 size-4 text-muted-foreground" />
            <Input
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              placeholder="Search name, SKU, or barcode…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </GlassPanel>

          <ProductGrid
            items={filtered}
            currency={currency}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
          {pending ? (
            <p className="text-center text-xs text-muted-foreground">Updating…</p>
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
        open={ingredientDialogOpen}
        onOpenChange={setIngredientDialogOpen}
        categories={categoryList}
        ingredients={ingredients}
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
