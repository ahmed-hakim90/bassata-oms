import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import * as onlineOrderRepo from "@/lib/repositories/online-order.repository";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { resolveVariantPrice } from "@/modules/products/services/variant.service";
import type { OnlineOrder, OnlineOrderItem, OnlineOrderStatus } from "@/lib/types";

type JsonRecord = Record<string, unknown>;

export type OnlineOrderLineInput = {
  productId: string;
  variantId?: string | null;
  quantity: number;
};

export type PublicOnlineOrderInput = {
  slug: string;
  customerName: string;
  customerPhone?: string;
  notes?: string;
  lines: OnlineOrderLineInput[];
};

export type StaffOnlineOrderInput = {
  customerName: string;
  customerPhone: string;
  notes?: string;
  lines: OnlineOrderLineInput[];
};

export interface OnlineOrderWithItems extends OnlineOrder {
  items: OnlineOrderItem[];
  storeName: string;
}

export type StaffOnlineProductOption = {
  id: string;
  name: string;
  price: number;
  variants: { id: string; name: string; price: number }[];
};

function asRecord(value: Json | null | undefined): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeLineInputs(lines: OnlineOrderLineInput[]) {
  const merged = new Map<string, OnlineOrderLineInput>();
  for (const line of lines) {
    const productId = line.productId?.trim();
    const variantId = line.variantId?.trim() || null;
    const quantity = Math.floor(Number(line.quantity));
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) continue;
    if (quantity > 99) throw new Error("Maximum quantity per line is 99");
    const key = `${productId}:${variantId ?? ""}`;
    const existing = merged.get(key);
    merged.set(key, {
      productId,
      variantId,
      quantity: (existing?.quantity ?? 0) + quantity,
    });
  }
  const result = [...merged.values()];
  if (result.length === 0) throw new Error("Add at least one item");
  if (result.length > 50) throw new Error("Maximum order size is 50 lines");
  return result;
}

async function priceLinesForPublicOrder(storeOrgId: string, lines: OnlineOrderLineInput[]) {
  const admin = createAdminClient();
  const normalized = normalizeLineInputs(lines);
  const productIds = [...new Set(normalized.map((line) => line.productId))];
  const variantIds = [...new Set(normalized.map((line) => line.variantId).filter(Boolean))] as string[];

  const [{ data: products, error: productsError }, { data: variants, error: variantsError }] =
    await Promise.all([
      admin
        .from("products")
        .select(
          "id, org_id, name, base_price, sale_price, is_active, product_type, inventory_product_type"
        )
        .eq("org_id", storeOrgId)
        .in("id", productIds),
      variantIds.length > 0
        ? admin
            .from("product_variants")
            .select("id, product_id, name, price, price_delta, is_active")
            .in("id", variantIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (productsError) throw new Error(productsError.message);
  if (variantsError) throw new Error(variantsError.message);

  const productMap = new Map((products ?? []).map((product) => [product.id, product]));
  const variantMap = new Map((variants ?? []).map((variant) => [variant.id, variant]));
  const { data: allActiveVariants, error: activeVariantsError } = await admin
    .from("product_variants")
    .select("id, product_id, is_active")
    .in("product_id", productIds)
    .eq("is_active", true);
  if (activeVariantsError) throw new Error(activeVariantsError.message);
  const productsWithVariants = new Set((allActiveVariants ?? []).map((variant) => variant.product_id));

  const priced = normalized.map((line) => {
    const product = productMap.get(line.productId);
    if (
      !product ||
      !product.is_active ||
      product.product_type !== "finished" ||
      product.inventory_product_type !== "finished_product"
    ) {
      throw new Error("One or more items are not available");
    }
    if (productsWithVariants.has(product.id) && !line.variantId) {
      throw new Error(`Choose an option for ${product.name}`);
    }

    const basePrice = Number(product.sale_price ?? product.base_price);
    let unitPrice = basePrice;
    let variantName: string | null = null;
    if (line.variantId) {
      const variant = variantMap.get(line.variantId);
      if (!variant || !variant.is_active || variant.product_id !== product.id) {
        throw new Error("One or more selected options are not available");
      }
      variantName = variant.name;
      unitPrice = variant.price == null ? basePrice + Number(variant.price_delta) : Number(variant.price);
    }

    return {
      product_id: product.id,
      variant_id: line.variantId ?? null,
      product_name: product.name,
      variant_name: variantName,
      quantity: line.quantity,
      unit_price: money(unitPrice),
      line_total: money(unitPrice * line.quantity),
    };
  });

  return {
    items: priced,
    subtotal: money(priced.reduce((sum, item) => sum + item.line_total, 0)),
  };
}

async function priceLinesForStaffOrder(lines: OnlineOrderLineInput[]) {
  const normalized = normalizeLineInputs(lines);
  const priced = [];
  for (const line of normalized) {
    const product = await catalogRepo.getProduct(line.productId);
    if (
      !product ||
      !product.is_active ||
      product.product_type !== "finished" ||
      product.inventory_product_type !== "finished_product"
    ) {
      throw new Error("One or more items are not available");
    }

    const variants = (await catalogRepo.listVariants(product.id)).filter((variant) => variant.is_active);
    if (variants.length > 0 && !line.variantId) {
      throw new Error(`Choose an option for ${product.name}`);
    }

    const variant = line.variantId ? variants.find((candidate) => candidate.id === line.variantId) : null;
    if (line.variantId && !variant) {
      throw new Error("One or more selected options are not available");
    }

    const unitPrice = variant
      ? resolveVariantPrice(product.sale_price ?? product.base_price, variant)
      : product.sale_price ?? product.base_price;
    priced.push({
      product_id: product.id,
      variant_id: variant?.id ?? null,
      product_name: product.name,
      variant_name: variant?.name ?? null,
      quantity: line.quantity,
      unit_price: money(unitPrice),
      line_total: money(unitPrice * line.quantity),
    });
  }

  return {
    items: priced,
    subtotal: money(priced.reduce((sum, item) => sum + item.line_total, 0)),
  };
}

async function ensureCustomerForPublicOrder(input: {
  orgId: string;
  name: string;
  phone: string;
}) {
  if (!input.phone) return;

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("customers")
    .select("id")
    .eq("org_id", input.orgId)
    .eq("phone", input.phone)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return;

  const { error: insertError } = await admin.from("customers").insert({
    org_id: input.orgId,
    name: input.name,
    phone: input.phone,
    notes: "Created from online menu order",
    total_spent: 0,
    visit_count: 0,
    account_balance: 0,
    credit_limit: 0,
    payment_terms: "",
  });
  if (insertError) throw new Error(insertError.message);
}

export async function submitPublicOnlineOrder(input: PublicOnlineOrderInput) {
  const slug = input.slug.trim().toLowerCase();
  const customerName = input.customerName.trim();
  const customerPhone = input.customerPhone?.trim() ?? "";
  const notes = input.notes?.trim() ?? "";
  if (!slug) throw new Error("Menu link is invalid");
  if (customerName.length < 2) throw new Error("Customer name is required");
  if (customerPhone && customerPhone.length < 5) {
    throw new Error("Enter a valid phone number or leave it empty");
  }
  if (customerName.length > 120 || customerPhone.length > 40 || notes.length > 500) {
    throw new Error("Order details are too long");
  }

  const admin = createAdminClient();
  const { data: store, error: storeError } = await admin
    .from("stores")
    .select("id, org_id, name, is_active, settings")
    .eq("is_active", true)
    .filter("settings->>online_menu_slug", "eq", slug)
    .maybeSingle();
  if (storeError) throw new Error(storeError.message);
  if (!store) throw new Error("Menu is not available");

  const settings = asRecord(store.settings);
  if (settings.online_menu_enabled !== true || settings.online_menu_ordering_enabled !== true) {
    throw new Error("Online ordering is currently unavailable");
  }

  const priced = await priceLinesForPublicOrder(store.org_id, input.lines);
  if (customerPhone) {
    await ensureCustomerForPublicOrder({
      orgId: store.org_id,
      name: customerName,
      phone: customerPhone,
    });
  }

  const { data: order, error: orderError } = await admin
    .from("online_orders")
    .insert({
      store_id: store.id,
      customer_name: customerName,
      customer_phone: customerPhone,
      notes,
      subtotal: priced.subtotal,
      total: priced.subtotal,
      discount: 0,
      tax: 0,
      status: "pending",
    })
    .select()
    .single();
  if (orderError || !order) throw new Error(orderError?.message ?? "Could not submit order");

  const { error: itemsError } = await admin
    .from("online_order_items")
    .insert(priced.items.map((item) => ({ online_order_id: order.id, ...item })));
  if (itemsError) throw new Error(itemsError.message);

  return { id: order.id, total: Number(order.total), storeName: store.name };
}

export async function listOnlineOrders(storeId?: string) {
  return onlineOrderRepo.listOnlineOrders(storeId);
}

export async function getOnlineOrderWithItems(id: string): Promise<OnlineOrderWithItems | null> {
  const order = await onlineOrderRepo.getOnlineOrder(id);
  if (!order) return null;
  const [items, store] = await Promise.all([
    onlineOrderRepo.getOnlineOrderItems(id),
    storeRepo.getStore(order.store_id),
  ]);
  return { ...order, items, storeName: store?.name ?? "Store" };
}

export async function listOnlineOrdersWithItems(storeId?: string): Promise<OnlineOrderWithItems[]> {
  const orders = await onlineOrderRepo.listOnlineOrders(storeId);
  return Promise.all(
    orders.map(async (order) => {
      const [items, store] = await Promise.all([
        onlineOrderRepo.getOnlineOrderItems(order.id),
        storeRepo.getStore(order.store_id),
      ]);
      return { ...order, items, storeName: store?.name ?? "Store" };
    })
  );
}

export async function listStaffOnlineProductOptions(): Promise<StaffOnlineProductOption[]> {
  const products = (await catalogRepo.listProducts({ activeOnly: true })).filter(
    (product) =>
      product.product_type === "finished" &&
      product.inventory_product_type === "finished_product" &&
      (product.sale_price ?? product.base_price) > 0
  );
  const variantMap = await catalogRepo.listVariantsForProducts(products.map((product) => product.id));
  return products.map((product) => {
    const basePrice = product.sale_price ?? product.base_price;
    return {
      id: product.id,
      name: product.name,
      price: money(basePrice),
      variants: (variantMap.get(product.id) ?? [])
        .filter((variant) => variant.is_active)
        .map((variant) => ({
          id: variant.id,
          name: variant.name,
          price: money(resolveVariantPrice(basePrice, variant)),
        })),
    };
  });
}

export async function updateOnlineOrderDetails(
  id: string,
  input: StaffOnlineOrderInput,
  userId: string
) {
  const existing = await onlineOrderRepo.getOnlineOrder(id);
  if (!existing || existing.status === "cancelled" || existing.status === "invoiced") {
    throw new Error("Order cannot be edited");
  }
  const customerName = input.customerName.trim();
  const customerPhone = input.customerPhone.trim();
  if (customerName.length < 2 || customerPhone.length < 5) {
    throw new Error("Customer name and phone are required");
  }

  const priced = await priceLinesForStaffOrder(input.lines);
  await onlineOrderRepo.updateOnlineOrder(id, {
    customer_name: customerName,
    customer_phone: customerPhone,
    notes: input.notes?.trim() ?? "",
    subtotal: priced.subtotal,
    total: priced.subtotal,
    discount: 0,
    tax: 0,
  });
  await onlineOrderRepo.replaceOnlineOrderItems(id, priced.items);

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: existing.store_id,
    userId,
    action: "online_order.updated",
    entityType: "online_order",
    entityId: id,
  });

  return getOnlineOrderWithItems(id);
}

export async function updateOnlineOrderStatus(
  id: string,
  status: Exclude<OnlineOrderStatus, "invoiced">,
  userId: string
) {
  const existing = await onlineOrderRepo.getOnlineOrder(id);
  if (!existing || existing.status === "invoiced") throw new Error("Order cannot be updated");
  if (existing.status === "cancelled" && status !== "cancelled") {
    throw new Error("Cancelled orders cannot be reopened");
  }
  const updated = await onlineOrderRepo.updateOnlineOrder(id, { status });
  if (!updated) throw new Error("Order not found");

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: existing.store_id,
    userId,
    action: status === "cancelled" ? "online_order.cancelled" : "online_order.status_updated",
    entityType: "online_order",
    entityId: id,
    metadata: { status },
  });

  return updated;
}

export async function invoiceOnlineOrder(input: {
  onlineOrderId: string;
  sessionId: string;
  cashierId: string;
  storeId: string;
  userId: string;
}) {
  const order = await getOnlineOrderWithItems(input.onlineOrderId);
  if (!order) throw new Error("Online order not found");
  if (order.store_id !== input.storeId) throw new Error("Online order belongs to another store");
  if (order.status === "cancelled") throw new Error("Cancelled orders cannot be invoiced");
  if (order.status === "invoiced") throw new Error("Order already invoiced");

  const result = await orderRepo.completeUnpaidCheckoutRpc({
    storeId: input.storeId,
    sessionId: input.sessionId,
    cashierId: input.cashierId,
    customerId: null,
    discount: 0,
    lines: order.items.map((item) => ({
      product_id: item.product_id,
      variant_id: item.variant_id,
      quantity: item.quantity,
    })),
  });

  await onlineOrderRepo.updateOnlineOrder(order.id, {
    status: "invoiced",
    order_id: result.order_id,
  });

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: input.storeId,
    userId: input.userId,
    action: "online_order.invoiced",
    entityType: "online_order",
    entityId: order.id,
    metadata: { orderId: result.order_id, orderNumber: result.order_number },
  });

  return result;
}
