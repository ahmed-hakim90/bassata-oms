import { normalizeMenuSlug } from "@/lib/online-menu-path";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_ONLINE_MENU_SETTINGS,
  normalizeOnlineMenuSettings,
} from "@/modules/system/services/settings.service";
import type { OnlineMenuSettings } from "@/lib/types";

export interface PublicMenuStore {
  id: string;
  orgId: string;
  name: string;
  address: string;
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

export interface PublicMenuProduct {
  id: string;
  categoryId: string | null;
  name: string;
  sku: string;
  barcode: string;
  price: number;
  imageUrl: string | null;
  isPopular: boolean;
  variants: PublicMenuVariant[];
}

export interface PublicMenuVariant {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  price: number;
  imageUrl: string | null;
}

export interface PublicMenuData {
  store: PublicMenuStore;
  categories: PublicMenuCategory[];
  products: PublicMenuProduct[];
  settings: OnlineMenuSettings;
}

export interface PublicOrderInput {
  token: string;
  customerName: string;
  customerPhone: string;
  notes?: string;
  lines: { productId: string; variantId?: string | null; quantity: number }[];
}

function num(value: number | string | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "string" ? Number(value) : value;
}

function normalizePhone(phone: string) {
  return phone.replace(/\s+/g, "").trim();
}

export function resolvePublicVariantPrice(
  basePrice: number,
  variant: { price: number | string | null; price_delta: number | string | null }
): number {
  if (variant.price != null) return num(variant.price);
  return basePrice + num(variant.price_delta);
}

async function getOnlineMenuSettingsForOrg(orgId: string): Promise<OnlineMenuSettings> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_settings")
    .select("value")
    .eq("org_id", orgId)
    .eq("key", "online_menu_settings")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const value = data?.value;
  return normalizeOnlineMenuSettings(
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : DEFAULT_ONLINE_MENU_SETTINGS
  );
}

async function getTaxRate(orgId: string): Promise<number> {
  const admin = createAdminClient();
  const { data: flagSetting } = await admin
    .from("app_settings")
    .select("value")
    .eq("org_id", orgId)
    .eq("key", "feature_flags")
    .maybeSingle();
  const flags = (flagSetting?.value ?? {}) as Record<string, unknown>;
  if (flags.tax === false) return 0;

  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("org_id", orgId)
    .eq("key", "tax_rate")
    .maybeSingle();
  const value = (data?.value ?? {}) as Record<string, unknown>;
  return num(value.rate as number | string | undefined);
}

async function resolveStoreByMenuIdentifier(identifier: string) {
  const admin = createAdminClient();
  const slug = normalizeMenuSlug(identifier);

  const { data: bySlug, error: slugError } = await admin
    .from("stores")
    .select("*")
    .eq("settings->>online_menu_slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (slugError) throw new Error(slugError.message);
  if (bySlug) return bySlug;

  const { data: byToken, error: tokenError } = await admin
    .from("stores")
    .select("*")
    .contains("settings", { online_menu_token: identifier })
    .eq("is_active", true)
    .maybeSingle();
  if (tokenError) throw new Error(tokenError.message);
  if (byToken) return byToken;

  return null;
}

export async function getPublicMenu(token: string): Promise<PublicMenuData | null> {
  const store = await resolveStoreByMenuIdentifier(token);
  if (!store) return null;

  const admin = createAdminClient();
  const [
    { data: categories, error: categoriesError },
    { data: products, error: productsError },
    settings,
  ] =
    await Promise.all([
      admin
        .from("categories")
        .select("*")
        .eq("org_id", store.org_id)
        .order("sort_order"),
      admin
        .from("products")
        .select("*")
        .eq("org_id", store.org_id)
        .eq("is_active", true)
        .eq("product_type", "finished")
        .order("name"),
      getOnlineMenuSettingsForOrg(store.org_id),
    ]);
  if (categoriesError) throw new Error(categoriesError.message);
  if (productsError) throw new Error(productsError.message);

  const productIds = (products ?? []).map((product) => product.id);
  const { data: variants, error: variantsError } =
    productIds.length > 0
      ? await admin
          .from("product_variants")
          .select("*")
          .in("product_id", productIds)
          .eq("is_active", true)
      : { data: [], error: null };
  if (variantsError) throw new Error(variantsError.message);

  const variantsByProduct = new Map<string, PublicMenuVariant[]>();
  for (const variant of variants ?? []) {
    const list = variantsByProduct.get(variant.product_id) ?? [];
    const product = (products ?? []).find((row) => row.id === variant.product_id);
    const basePrice = num(product?.base_price);
    list.push({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      barcode: variant.barcode,
      price: resolvePublicVariantPrice(basePrice, variant),
      imageUrl: variant.image_url,
    });
    variantsByProduct.set(variant.product_id, list);
  }

  return {
    store: {
      id: store.id,
      orgId: store.org_id,
      name: store.name,
      address: store.address,
    },
    categories: (categories ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      sortOrder: category.sort_order,
    })),
    products: (products ?? []).map((product) => ({
      id: product.id,
      categoryId: product.category_id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      price: num(product.base_price),
      imageUrl: product.image_url,
      isPopular: product.is_popular,
      variants: (variantsByProduct.get(product.id) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    })),
    settings,
  };
}

export function buildPublicOrderLines(
  products: PublicMenuProduct[],
  lines: PublicOrderInput["lines"]
) {
  const qtyBySelection = new Map<string, number>();
  for (const line of lines) {
    const qty = Math.floor(line.quantity);
    if (qty <= 0) continue;
    const variantId = line.variantId ?? null;
    const key = `${line.productId}:${variantId ?? ""}`;
    qtyBySelection.set(key, (qtyBySelection.get(key) ?? 0) + qty);
  }
  if (qtyBySelection.size === 0) throw new Error("Cart is empty");

  const productMap = new Map(products.map((product) => [product.id, product]));
  return [...qtyBySelection.entries()].map(([key, quantity]) => {
    const [productId, variantIdPart] = key.split(":");
    const variantId = variantIdPart || null;
    const product = productMap.get(productId!);
    if (!product) throw new Error("A product in the cart is no longer available");
    const variant = variantId ? product.variants.find((item) => item.id === variantId) : null;
    if (variantId && !variant) {
      throw new Error("A product option in the cart is no longer available");
    }
    const unitPrice = variant?.price ?? product.price;
    return {
      productId: product.id,
      variantId,
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
    };
  });
}

export async function submitPublicOrder(input: PublicOrderInput): Promise<{
  id: string;
  total: number;
}> {
  const name = input.customerName.trim();
  const phone = normalizePhone(input.customerPhone);
  if (name.length < 2) throw new Error("Name is required");
  if (phone.length < 6) throw new Error("Phone number is required");
  if (input.lines.length === 0) throw new Error("Cart is empty");

  const menu = await getPublicMenu(input.token);
  if (!menu) throw new Error("Menu not found");

  const orderLines = buildPublicOrderLines(menu.products, input.lines);

  const subtotal = orderLines.reduce((sum, line) => sum + line.lineTotal, 0);
  const taxRate = await getTaxRate(menu.store.orgId);
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const total = subtotal + tax;

  const admin = createAdminClient();
  const { data: customer, error: customerError } = await admin
    .from("customers")
    .upsert(
      {
        org_id: menu.store.orgId,
        name,
        phone,
        notes: "",
      },
      { onConflict: "org_id,phone" }
    )
    .select()
    .single();
  if (customerError || !customer) {
    throw new Error(customerError?.message ?? "Could not save customer");
  }

  const { data: order, error: orderError } = await admin
    .from("online_orders")
    .insert({
      store_id: menu.store.id,
      customer_id: customer.id,
      customer_name: name,
      customer_phone: phone,
      subtotal,
      discount: 0,
      tax,
      total,
      notes: input.notes?.trim() ?? "",
    })
    .select()
    .single();
  if (orderError || !order) {
    throw new Error(orderError?.message ?? "Could not create online order");
  }

  const { error: itemError } = await admin.from("online_order_items").insert(
    orderLines.map((line) => ({
      online_order_id: order.id,
      product_id: line.productId,
      variant_id: line.variantId,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      line_total: line.lineTotal,
    }))
  );
  if (itemError) throw new Error(itemError.message);

  return { id: order.id, total };
}
