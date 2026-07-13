import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import * as onlineOrderRepo from "@/lib/repositories/online-order.repository";
import * as orderRepo from "@/lib/repositories/order.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { resolveVariantPrice } from "@/modules/products/services/variant.service";
import {
  releaseStockForOnlineOrder,
  reserveStockForOnlineOrder,
} from "@/modules/online-orders/services/online-order-reservation.service";
import { evaluateOnlineOrderingAvailability } from "@/modules/online-menu/lib/online-ordering-hours";
import {
  parseOnlineFulfillment,
  resolveOnlineFulfillmentFee,
  type OnlineFulfillmentType,
} from "@/modules/online-menu/lib/online-fulfillment";
import { assertOnlinePublicRateLimit } from "@/modules/online-menu/lib/online-public-rate-limit";
import { buildOnlineOrderTrackingPath } from "@/modules/online-orders/lib/online-order-tracking";
import { canTransitionOnlineOrderStatus } from "@/modules/online-orders/lib/online-order-status";
import { normalizeOnlineMenuSlug } from "@/lib/slugify";
import type { OnlineOrder, OnlineOrderItem, OnlineOrderStatus } from "@/lib/types";

type JsonRecord = Record<string, unknown>;

export type OnlineOrderLineInput = {
  productId: string;
  variantId?: string | null;
  quantity: number;
};

export type PublicOnlineOrderInput = {
  slug: string;
  /** Required when the branch menu is unlisted. */
  token?: string | null;
  customerName: string;
  customerPhone?: string;
  notes?: string;
  fulfillmentType: OnlineFulfillmentType;
  zoneId?: string | null;
  deliveryAddress?: string | null;
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
    if (quantity > 99) throw new Error("الحد الأقصى للكمية في السطر هو 99");
    const key = `${productId}:${variantId ?? ""}`;
    const existing = merged.get(key);
    merged.set(key, {
      productId,
      variantId,
      quantity: (existing?.quantity ?? 0) + quantity,
    });
  }
  const result = [...merged.values()];
  if (result.length === 0) throw new Error("أضف صنفاً واحداً على الأقل");
  if (result.length > 50) throw new Error("الحد الأقصى للطلب 50 سطراً");
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
          "id, org_id, name, base_price, sale_price, is_active, product_type, inventory_product_type, show_on_online_menu"
        )
        .eq("org_id", storeOrgId)
        .eq("is_active", true)
        .eq("product_type", "finished")
        .eq("inventory_product_type", "finished_product")
        .eq("show_on_online_menu", true)
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

  const productMap = new Map(
    (products ?? [])
      .filter((product) => product.org_id === storeOrgId && product.show_on_online_menu === true)
      .map((product) => [product.id, product])
  );
  const variantMap = new Map(
    (variants ?? [])
      .filter(
        (variant) =>
          variant.is_active &&
          productMap.has(variant.product_id) &&
          productIds.includes(variant.product_id)
      )
      .map((variant) => [variant.id, variant])
  );
  const scopedProductIds = [...productMap.keys()];
  const { data: allActiveVariants, error: activeVariantsError } =
    scopedProductIds.length > 0
      ? await admin
          .from("product_variants")
          .select("id, product_id, is_active")
          .in("product_id", scopedProductIds)
          .eq("is_active", true)
      : { data: [], error: null };
  if (activeVariantsError) throw new Error(activeVariantsError.message);
  const productsWithVariants = new Set((allActiveVariants ?? []).map((variant) => variant.product_id));

  const priced = normalized.map((line) => {
    const product = productMap.get(line.productId);
    if (
      !product ||
      !product.is_active ||
      product.org_id !== storeOrgId ||
      product.product_type !== "finished" ||
      product.inventory_product_type !== "finished_product" ||
      product.show_on_online_menu !== true
    ) {
      throw new Error("بعض الأصناف غير متاحة");
    }
    if (productsWithVariants.has(product.id) && !line.variantId) {
      throw new Error(`اختر خياراً لـ ${product.name}`);
    }

    const basePrice = Number(product.sale_price ?? product.base_price);
    let unitPrice = basePrice;
    let variantName: string | null = null;
    if (line.variantId) {
      const variant = variantMap.get(line.variantId);
      if (!variant || !variant.is_active || variant.product_id !== product.id) {
        throw new Error("بعض الخيارات المحددة غير متاحة");
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
      throw new Error("بعض الأصناف غير متاحة");
    }

    const variants = (await catalogRepo.listVariants(product.id)).filter((variant) => variant.is_active);
    if (variants.length > 0 && !line.variantId) {
      throw new Error(`اختر خياراً لـ ${product.name}`);
    }

    const variant = line.variantId ? variants.find((candidate) => candidate.id === line.variantId) : null;
    if (line.variantId && !variant) {
      throw new Error("بعض الخيارات المحددة غير متاحة");
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

async function findOnlineOrderCustomerId(input: {
  orgId: string;
  phone: string | null | undefined;
}): Promise<string | null> {
  const phone = input.phone?.trim() ?? "";
  if (!phone) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("customers")
    .select("id")
    .eq("org_id", input.orgId)
    .eq("phone", phone)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export async function submitPublicOnlineOrder(input: PublicOnlineOrderInput) {
  const slug = normalizeOnlineMenuSlug(input.slug);
  const menuToken = input.token?.trim() ?? "";
  const customerName = input.customerName.trim();
  const customerPhone = input.customerPhone?.trim() ?? "";
  const notes = input.notes?.trim() ?? "";
  if (!slug) throw new Error("رابط المنيو غير صالح");
  if (customerName.length < 2) throw new Error("الاسم مطلوب");
  if (customerPhone && customerPhone.length < 5) {
    throw new Error("رقم الهاتف قصير أو غير صالح — صحّحه أو اتركه فارغًا");
  }
  if (customerName.length > 120 || customerPhone.length > 40 || notes.length > 500) {
    throw new Error("تفاصيل الطلب طويلة جدًا");
  }

  await assertOnlinePublicRateLimit({ action: "order_create", slug });

  const admin = createAdminClient();
  const { data: store, error: storeError } = await admin
    .from("stores")
    .select("id, org_id, name, timezone, is_active, settings")
    .eq("is_active", true)
    .filter("settings->>online_menu_slug", "eq", slug)
    .maybeSingle();
  if (storeError) throw new Error(storeError.message);
  if (!store) throw new Error("المنيو غير متاح");

  const settings = asRecord(store.settings);
  if (settings.online_menu_enabled !== true) {
    throw new Error("الطلب الأونلاين غير متاح حاليًا");
  }
  if (settings.online_menu_unlisted === true) {
    const expectedToken =
      typeof settings.online_menu_token === "string" ? settings.online_menu_token.trim() : "";
    if (!expectedToken || menuToken !== expectedToken) {
      throw new Error("المنيو غير متاح");
    }
  }

  const availability = evaluateOnlineOrderingAvailability({
    settings,
    storeTimezone: store.timezone,
  });
  if (!availability.canOrder) {
    throw new Error(availability.messageAr);
  }

  const fulfillmentConfig = parseOnlineFulfillment(settings);
  const fulfillment = resolveOnlineFulfillmentFee(fulfillmentConfig, {
    fulfillmentType: input.fulfillmentType,
    zoneId: input.zoneId,
    deliveryAddress: input.deliveryAddress,
  });

  const priced = await priceLinesForPublicOrder(store.org_id, input.lines);
  const total = money(priced.subtotal + fulfillment.deliveryFee);

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
      customer_phone: customerPhone || null,
      notes,
      subtotal: priced.subtotal,
      total,
      discount: 0,
      tax: 0,
      status: "pending",
      fulfillment_type: fulfillment.fulfillmentType,
      delivery_area: fulfillment.deliveryArea,
      delivery_address: fulfillment.deliveryAddress,
      delivery_fee: fulfillment.deliveryFee,
    })
    .select()
    .single();
  if (orderError || !order) {
    const msg = orderError?.message ?? "";
    if (msg.includes("online_orders_customer_phone_not_blank") || msg.includes("customer_phone")) {
      throw new Error("رقم الهاتف مطلوب أو اتركه فارغًا حسب إعداد المتجر");
    }
    throw new Error(msg || "تعذر إرسال الطلب");
  }

  const { error: itemsError } = await admin
    .from("online_order_items")
    .insert(priced.items.map((item) => ({ online_order_id: order.id, ...item })));
  if (itemsError) throw new Error(itemsError.message);

  return {
    id: order.id,
    total: Number(order.total),
    deliveryFee: fulfillment.deliveryFee,
    fulfillmentType: fulfillment.fulfillmentType,
    storeName: store.name,
    trackingPath: buildOnlineOrderTrackingPath(order.id),
  };
}

export async function listOnlineOrders(
  storeIdOrFilters?: string | onlineOrderRepo.OnlineOrderListFilters
) {
  return onlineOrderRepo.listOnlineOrders(storeIdOrFilters);
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

const ACTIVE_ONLINE_ORDER_STATUSES: OnlineOrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "ready",
];

export async function listOnlineOrdersWithItems(
  storeIdOrFilters?: string | onlineOrderRepo.OnlineOrderListFilters
): Promise<OnlineOrderWithItems[]> {
  const orders = await onlineOrderRepo.listOnlineOrders(storeIdOrFilters);
  if (orders.length === 0) return [];

  const [itemsByOrder, stores] = await Promise.all([
    onlineOrderRepo.listOnlineOrderItemsForOrders(orders.map((order) => order.id)),
    storeRepo.listStores(),
  ]);
  const storeNameById = new Map(stores.map((store) => [store.id, store.name]));

  return orders.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) ?? [],
    storeName: storeNameById.get(order.store_id) ?? "Store",
  }));
}

/** Active queue only — used by POS (excludes cancelled/invoiced history). */
export async function listActiveOnlineOrdersWithItems(
  storeId: string,
  limit = 50
): Promise<OnlineOrderWithItems[]> {
  return listOnlineOrdersWithItems({
    storeId,
    statuses: ACTIVE_ONLINE_ORDER_STATUSES,
    limit,
  });
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
    throw new Error("لا يمكن تعديل هذا الطلب");
  }
  const customerName = input.customerName.trim();
  const customerPhone = input.customerPhone.trim();
  if (customerName.length < 2) {
    throw new Error("اسم العميل مطلوب");
  }
  if (customerPhone && customerPhone.length < 5) {
    throw new Error("رقم الهاتف قصير أو غير صالح — صحّحه أو اتركه فارغًا");
  }

  const priced = await priceLinesForStaffOrder(input.lines);
  const deliveryFee = money(existing.delivery_fee ?? 0);
  await onlineOrderRepo.updateOnlineOrder(id, {
    customer_name: customerName,
    customer_phone: customerPhone || null,
    notes: input.notes?.trim() ?? "",
    subtotal: priced.subtotal,
    total: money(priced.subtotal + deliveryFee),
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
  if (!existing || existing.status === "invoiced") throw new Error("لا يمكن تحديث هذا الطلب");
  if (existing.status === "cancelled" && status !== "cancelled") {
    throw new Error("لا يمكن إعادة فتح طلب ملغي");
  }
  if (!canTransitionOnlineOrderStatus(existing.status, status)) {
    throw new Error("انتقال الحالة غير مسموح لهذا الطلب");
  }

  const fulfillmentStatuses: OnlineOrderStatus[] = ["accepted", "preparing", "ready"];
  const becomingAccepted =
    existing.status === "pending" && fulfillmentStatuses.includes(status);
  const becomingCancelled =
    status === "cancelled" && existing.status !== "cancelled";

  if (becomingAccepted) {
    await reserveStockForOnlineOrder(existing, userId);
  }
  if (becomingCancelled) {
    await releaseStockForOnlineOrder(existing, userId, "إلغاء طلب أونلاين — تحرير الحجز");
  }

  const updated = await onlineOrderRepo.updateOnlineOrder(id, { status });
  if (!updated) throw new Error("الطلب غير موجود");

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
  deviceId?: string | null;
  payments: { method: import("@/lib/types").PaymentMethod; amount: number }[];
}) {
  const order = await getOnlineOrderWithItems(input.onlineOrderId);
  if (!order) throw new Error("الطلب الأونلاين غير موجود");
  if (order.store_id !== input.storeId) throw new Error("الطلب يتبع فرعاً آخر");
  if (order.status === "cancelled") throw new Error("لا يمكن فوترة طلب ملغي");
  if (order.status === "invoiced") throw new Error("الطلب مُفوتر مسبقاً");

  const store = await storeRepo.getStore(input.storeId);
  if (!store) throw new Error("الفرع غير موجود");

  const lines = order.items.map((item) => ({
    product_id: item.product_id,
    variant_id: item.variant_id,
    quantity: item.quantity,
  }));
  const roundMoney = (value: number) => Math.round(value * 100) / 100;
  const payments = input.payments
    .map((payment) => ({
      method: payment.method,
      amount: roundMoney(Number(payment.amount) || 0),
    }))
    .filter((payment) => payment.amount > 0);
  if (!payments.length) {
    throw new Error("أدخل مبلغ دفع صالحاً");
  }
  const paymentMethod = payments[0]?.method ?? "cash";

  const customerId = await findOnlineOrderCustomerId({
    orgId: store.org_id,
    phone: order.customer_phone,
  });
  const usesCredit = payments.some((payment) => payment.method === "credit");
  if (usesCredit && !customerId) {
    throw new Error("البيع الآجل يحتاج رقم هاتف عميل مسجّل");
  }

  // Release reservation before checkout sale deduction (avoids double-hold).
  await releaseStockForOnlineOrder(order, input.userId, "فوترة طلب أونلاين — تحرير الحجز");

  let result;
  try {
    result =
      payments.length > 1
        ? await orderRepo.completeCheckoutSplitRpc({
            storeId: input.storeId,
            sessionId: input.sessionId,
            cashierId: input.cashierId,
            customerId,
            paymentMethod,
            discount: 0,
            lines,
            payments,
            deviceId: input.deviceId ?? null,
          })
        : await orderRepo.completeCheckoutRpc({
            storeId: input.storeId,
            sessionId: input.sessionId,
            cashierId: input.cashierId,
            customerId,
            paymentMethod,
            discount: 0,
            lines,
            deviceId: input.deviceId ?? null,
          });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Split payments must equal order total")) {
      throw new Error("مبالغ الدفع المقسّم لا تطابق إجمالي الفاتورة");
    }
    if (message.includes("Credit cannot be mixed with split payments")) {
      throw new Error("لا يمكن خلط البيع الآجل مع الدفع المقسّم");
    }
    if (message.includes("Only one credit payment line is allowed")) {
      throw new Error("سطر آجل واحد فقط في الفاتورة");
    }
    if (message.includes("Credit limit exceeded")) {
      throw new Error("تم تجاوز حد الائتمان للعميل");
    }
    if (message.includes("Customer required for credit sale")) {
      throw new Error("اختر عميلًا للبيع الآجل");
    }
    if (message.includes("Payment amount must be greater than zero")) {
      throw new Error("مبلغ الدفع يجب أن يكون أكبر من صفر");
    }
    if (message.includes("Insufficient stock") || message.includes("Insufficient batch stock")) {
      throw new Error(
        "المخزون غير كافٍ — الفوترة متوقفة لأن إعداد «منع المخزون السالب» مفعّل. راجع الرصيد أو عطّل الإعداد من خصائص النظام."
      );
    }
    throw error;
  }

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
