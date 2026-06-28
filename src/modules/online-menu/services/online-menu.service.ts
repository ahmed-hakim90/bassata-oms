import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

type JsonRecord = Record<string, unknown>;

export type OnlineMenuVariant = {
  id: string;
  name: string;
  price: number;
};

export type OnlineMenuItem = {
  id: string;
  categoryId: string | null;
  name: string;
  description: string;
  imageUrl: string | null;
  price: number;
  isPopular: boolean;
  variants: OnlineMenuVariant[];
};

export type OnlineMenuCategory = {
  id: string;
  name: string;
  sortOrder: number;
  color: string;
  icon: string;
};

export type OnlineMenuData = {
  organization: {
    name: string;
    currency: string;
    logoUrl: string | null;
  };
  store: {
    id: string;
    name: string;
    address: string;
    phone: string;
    description: string;
    orderingEnabled: boolean;
  };
  categories: OnlineMenuCategory[];
  items: OnlineMenuItem[];
};

function asRecord(value: Json | null | undefined): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function num(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseFloat(value) || 0;
  return 0;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function getOnlineMenuBySlug(slug: string): Promise<OnlineMenuData | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;

  const admin = createAdminClient();
  const { data: store, error: storeError } = await admin
    .from("stores")
    .select("id, org_id, name, address, phone, is_active, settings")
    .eq("is_active", true)
    .filter("settings->>online_menu_slug", "eq", normalizedSlug)
    .maybeSingle();

  if (storeError) throw new Error(storeError.message);
  if (!store) return null;

  const storeSettings = asRecord(store.settings);
  if (storeSettings.online_menu_enabled !== true) return null;

  const [{ data: organization, error: orgError }, { data: categoryRows, error: categoriesError }] =
    await Promise.all([
      admin
        .from("organizations")
        .select("id, name, currency, logo_url")
        .eq("id", store.org_id)
        .maybeSingle(),
      admin
        .from("categories")
        .select("id, name, sort_order, color, icon")
        .eq("org_id", store.org_id)
        .order("sort_order", { ascending: true }),
    ]);

  if (orgError) throw new Error(orgError.message);
  if (categoriesError) throw new Error(categoriesError.message);
  if (!organization) return null;

  const { data: productRows, error: productsError } = await admin
    .from("products")
    .select("id, category_id, name, description, image_url, base_price, sale_price, is_popular")
    .eq("org_id", store.org_id)
    .eq("is_active", true)
    .eq("product_type", "finished")
    .eq("inventory_product_type", "finished_product")
    .gt("base_price", 0)
    .order("is_popular", { ascending: false })
    .order("name", { ascending: true });

  if (productsError) throw new Error(productsError.message);

  const productIds = (productRows ?? []).map((product) => product.id);
  const { data: variantRows, error: variantsError } =
    productIds.length > 0
      ? await admin
          .from("product_variants")
          .select("id, product_id, name, price, price_delta, is_active")
          .in("product_id", productIds)
          .eq("is_active", true)
          .order("name", { ascending: true })
      : { data: [], error: null };

  if (variantsError) throw new Error(variantsError.message);

  const variantsByProduct = new Map<string, OnlineMenuVariant[]>();
  for (const variant of variantRows ?? []) {
    const product = (productRows ?? []).find((row) => row.id === variant.product_id);
    const basePrice = num(product?.sale_price ?? product?.base_price);
    const price = variant.price == null ? basePrice + num(variant.price_delta) : num(variant.price);
    const list = variantsByProduct.get(variant.product_id) ?? [];
    list.push({ id: variant.id, name: variant.name, price });
    variantsByProduct.set(variant.product_id, list);
  }

  return {
    organization: {
      name: organization.name,
      currency: organization.currency,
      logoUrl: organization.logo_url ?? null,
    },
    store: {
      id: store.id,
      name: store.name,
      address: store.address,
      phone: text(storeSettings.phone) || store.phone,
      description: text(storeSettings.online_menu_description),
      orderingEnabled: storeSettings.online_menu_ordering_enabled === true,
    },
    categories: (categoryRows ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      sortOrder: category.sort_order,
      color: category.color,
      icon: category.icon,
    })),
    items: (productRows ?? []).map((product) => ({
      id: product.id,
      categoryId: product.category_id,
      name: product.name,
      description: product.description,
      imageUrl: product.image_url,
      price: num(product.sale_price ?? product.base_price),
      isPopular: product.is_popular,
      variants: variantsByProduct.get(product.id) ?? [],
    })),
  };
}
