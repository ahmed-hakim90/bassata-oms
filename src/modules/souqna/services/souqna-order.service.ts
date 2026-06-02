import { createAdminClient } from "@/lib/supabase/admin";
import * as onlineOrderRepo from "@/lib/repositories/online-order.repository";
import {
  findSouqnaOrderByExternalId,
  getDefaultWarehouseForStore,
  getProductAvailableStock,
  releaseSouqnaOrderReservations,
  reserveProductStock,
  writeSouqnaIntegrationLog,
} from "@/lib/repositories/souqna.repository";
import { getSouqnaIntegrationSettings } from "@/modules/system/services/settings.service";
import type { SouqnaOrderInput } from "@/modules/souqna/schemas/souqna-order.schema";
import type { SouqnaAuthContext } from "@/lib/api/souqna-auth";
import { notifySouqnaOrderStatusChange } from "@/modules/souqna/services/souqna-webhook.service";

const PRICE_TOLERANCE = 0.01;
const TOTAL_TOLERANCE = 0.05;

export interface SouqnaOrderResponse {
  external_order_id: string | null;
  status: "received" | "rejected";
  message: string;
}

function num(value: number | string | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "string" ? Number(value) : value;
}

function normalizePhone(phone: string) {
  return phone.replace(/\s+/g, "").trim();
}

function resolveUnitPrice(basePrice: number, salePrice: number | null): number {
  if (salePrice != null && salePrice < basePrice) return salePrice;
  return basePrice;
}

export { resolveUnitPrice, normalizePhone, PRICE_TOLERANCE, TOTAL_TOLERANCE };

type ProductLookup = {
  id: string;
  sku: string;
  name: string;
  base_price: number;
  sale_price: number | null;
  track_inventory: boolean;
  publish_to_souqna: boolean;
};

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

async function loadProduct(
  ctx: SouqnaAuthContext,
  externalProductId: string,
  sku: string
): Promise<ProductLookup | null> {
  const admin = createAdminClient();
  const { data: byId } = await admin
    .from("products")
    .select("id, sku, name, base_price, sale_price, track_inventory, publish_to_souqna")
    .eq("org_id", ctx.orgId)
    .eq("id", externalProductId)
    .maybeSingle();

  if (byId?.publish_to_souqna) {
    return byId as ProductLookup;
  }

  const { data: bySku } = await admin
    .from("products")
    .select("id, sku, name, base_price, sale_price, track_inventory, publish_to_souqna")
    .eq("org_id", ctx.orgId)
    .eq("sku", sku)
    .eq("publish_to_souqna", true)
    .maybeSingle();

  return (bySku as ProductLookup | null) ?? null;
}

async function rejectOrder(
  ctx: SouqnaAuthContext,
  payload: SouqnaOrderInput,
  message: string
): Promise<SouqnaOrderResponse> {
  const response: SouqnaOrderResponse = {
    external_order_id: null,
    status: "rejected",
    message,
  };
  await writeSouqnaIntegrationLog({
    orgId: ctx.orgId,
    storeId: ctx.storeId,
    direction: "inbound",
    endpoint: "/api/souqna/orders",
    requestType: "orders.create",
    requestPayload: payload as unknown as Record<string, unknown>,
    responsePayload: response as unknown as Record<string, unknown>,
    status: "rejected",
    error: message,
  });
  return response;
}

async function logOrderSuccess(
  ctx: SouqnaAuthContext,
  payload: SouqnaOrderInput,
  response: SouqnaOrderResponse
) {
  await writeSouqnaIntegrationLog({
    orgId: ctx.orgId,
    storeId: ctx.storeId,
    direction: "inbound",
    endpoint: "/api/souqna/orders",
    requestType: "orders.create",
    requestPayload: payload as unknown as Record<string, unknown>,
    responsePayload: response as unknown as Record<string, unknown>,
    status: "success",
  });
}

export async function releaseSouqnaOnlineOrderStock(onlineOrderId: string): Promise<void> {
  const order = await onlineOrderRepo.getOnlineOrder(onlineOrderId);
  if (!order || order.source !== "souqna") return;

  const settings = await getSouqnaIntegrationSettings();
  if (!settings.reserve_stock_on_online_order) return;

  const warehouse = await getDefaultWarehouseForStore(order.store_id);
  if (!warehouse) return;

  const items = await onlineOrderRepo.getOnlineOrderItems(onlineOrderId);
  await releaseSouqnaOrderReservations({
    storeId: order.store_id,
    warehouseId: warehouse.id,
    onlineOrderId,
    items: items.map((item) => ({ productId: item.product_id, quantity: item.quantity })),
  });
}

export async function createSouqnaOrder(
  ctx: SouqnaAuthContext,
  payload: SouqnaOrderInput
): Promise<SouqnaOrderResponse> {
  const existing = await findSouqnaOrderByExternalId(payload.souqna_order_id);
  if (existing) {
    const response: SouqnaOrderResponse = {
      external_order_id: existing.id,
      status: "received",
      message: "Order received successfully",
    };
    await logOrderSuccess(ctx, payload, response);
    return response;
  }

  const warehouse = await getDefaultWarehouseForStore(ctx.storeId);
  const validatedLines: {
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    trackInventory: boolean;
  }[] = [];

  for (const item of payload.items) {
    const product = await loadProduct(ctx, item.external_product_id, item.sku);
    if (!product) {
      return rejectOrder(ctx, payload, `Unknown product: ${item.sku}`);
    }

    const unitPrice = resolveUnitPrice(
      num(product.base_price),
      product.sale_price != null ? num(product.sale_price) : null
    );
    if (Math.abs(unitPrice - item.unit_price) > PRICE_TOLERANCE) {
      return rejectOrder(ctx, payload, `Price mismatch on ${item.sku}`);
    }

    if (product.track_inventory && warehouse) {
      const available = await getProductAvailableStock({
        storeId: ctx.storeId,
        warehouseId: warehouse.id,
        productId: product.id,
      });
      if (available < item.quantity) {
        return rejectOrder(ctx, payload, "Product out of stock");
      }
    }

    validatedLines.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      quantity: item.quantity,
      unitPrice,
      lineTotal: unitPrice * item.quantity,
      trackInventory: product.track_inventory,
    });
  }

  const subtotal = validatedLines.reduce((sum, line) => sum + line.lineTotal, 0);
  if (Math.abs(subtotal - payload.subtotal) > TOTAL_TOLERANCE) {
    return rejectOrder(ctx, payload, "Subtotal mismatch");
  }

  const expectedTotal = subtotal + payload.delivery_fee;
  if (Math.abs(expectedTotal - payload.total) > TOTAL_TOLERANCE) {
    return rejectOrder(ctx, payload, "Total mismatch");
  }

  const taxRate = await getTaxRate(ctx.orgId);
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const total = subtotal + tax + payload.delivery_fee;

  const admin = createAdminClient();
  const customerName = payload.customer_name.trim();
  const customerPhone = normalizePhone(payload.customer_phone);

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .upsert(
      {
        org_id: ctx.orgId,
        name: customerName,
        phone: customerPhone,
        notes: "",
      },
      { onConflict: "org_id,phone" }
    )
    .select()
    .single();
  if (customerError || !customer) {
    return rejectOrder(ctx, payload, customerError?.message ?? "Could not save customer");
  }

  const { data: order, error: orderError } = await admin
    .from("online_orders")
    .insert({
      store_id: ctx.storeId,
      customer_id: customer.id,
      customer_name: customerName,
      customer_phone: customerPhone,
      source: "souqna",
      external_order_id: payload.souqna_order_id,
      checkout_session_id: payload.checkout_session_id ?? null,
      fulfillment_type: payload.fulfillment_type,
      delivery_area: payload.delivery_area ?? "",
      delivery_address: payload.delivery_address ?? "",
      delivery_fee: payload.delivery_fee,
      payment_method: payload.payment_method,
      subtotal,
      discount: 0,
      tax,
      total,
      notes: payload.notes?.trim() ?? "",
      raw_payload: payload as unknown as import("@/lib/supabase/database.types").Json,
    })
    .select("*")
    .single();

  if (orderError || !order) {
    if (orderError?.code === "23505") {
      const dup = await findSouqnaOrderByExternalId(payload.souqna_order_id);
      if (dup) {
        return {
          external_order_id: dup.id,
          status: "received",
          message: "Order received successfully",
        };
      }
    }
    return rejectOrder(ctx, payload, orderError?.message ?? "Could not create order");
  }

  const { error: itemError } = await admin.from("online_order_items").insert(
    validatedLines.map((line) => ({
      online_order_id: order.id,
      product_id: line.productId,
      variant_id: null,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      line_total: line.lineTotal,
    }))
  );
  if (itemError) {
    await admin.from("online_orders").delete().eq("id", order.id);
    return rejectOrder(ctx, payload, itemError.message);
  }

  if (ctx.settings.reserve_stock_on_online_order && warehouse) {
    try {
      for (const line of validatedLines) {
        if (!line.trackInventory) continue;
        await reserveProductStock({
          storeId: ctx.storeId,
          warehouseId: warehouse.id,
          productId: line.productId,
          quantity: line.quantity,
          referenceId: order.id,
        });
      }
    } catch (error) {
      await admin.from("online_order_items").delete().eq("online_order_id", order.id);
      await admin.from("online_orders").delete().eq("id", order.id);
      const message = error instanceof Error ? error.message : "Product out of stock";
      return rejectOrder(ctx, payload, message);
    }
  }

  const response: SouqnaOrderResponse = {
    external_order_id: order.id,
    status: "received",
    message: "Order received successfully",
  };

  await logOrderSuccess(ctx, payload, response);

  const onlineOrder = await onlineOrderRepo.getOnlineOrder(order.id);
  if (onlineOrder) {
    await notifySouqnaOrderStatusChange({
      order: onlineOrder,
      orgId: ctx.orgId,
      status: "pending",
    });
  }

  return response;
}

export async function logSouqnaOrderError(
  ctx: SouqnaAuthContext | null,
  payload: Record<string, unknown> | null,
  error: unknown
) {
  if (!ctx) return;
  await writeSouqnaIntegrationLog({
    orgId: ctx.orgId,
    storeId: ctx.storeId,
    direction: "inbound",
    endpoint: "/api/souqna/orders",
    requestType: "orders.create",
    requestPayload: payload,
    status: "error",
    error: error instanceof Error ? error.message : "Unknown error",
  });
}
