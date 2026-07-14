import type { SalesMode } from "@/lib/constants";
import { getOrgId } from "@/lib/repositories/organization.repository";
import * as heldCartRepo from "@/lib/repositories/pos-held-cart.repository";
import type { CartLine, Customer } from "@/lib/types";
import type { HeldCart } from "@/stores/pos-store";

export type HeldCartPayload = {
  cart: CartLine[];
  customer: Customer | null;
  discountAmount: number;
  couponCode: string;
  salesMode: SalesMode;
};

function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.id === "string" &&
    typeof line.productId === "string" &&
    typeof line.name === "string" &&
    typeof line.quantity === "number" &&
    typeof line.unitPrice === "number" &&
    typeof line.lineTotal === "number" &&
    Array.isArray(line.modifiers)
  );
}

function parsePayload(raw: Record<string, unknown>): HeldCartPayload | null {
  const cart = raw.cart;
  if (!Array.isArray(cart) || cart.length === 0 || !cart.every(isCartLine)) {
    return null;
  }
  const discountAmount =
    typeof raw.discountAmount === "number" && Number.isFinite(raw.discountAmount)
      ? Math.max(0, raw.discountAmount)
      : 0;
  const couponCode = typeof raw.couponCode === "string" ? raw.couponCode : "";
  const salesMode: SalesMode =
    raw.salesMode === "wholesale" || raw.salesMode === "retail" ? raw.salesMode : "retail";
  const customer =
    raw.customer && typeof raw.customer === "object"
      ? (raw.customer as Customer)
      : null;

  return {
    cart,
    customer,
    discountAmount,
    couponCode,
    salesMode,
  };
}

export function mapHeldCartRowToHeldCart(
  row: heldCartRepo.PosHeldCartRow
): HeldCart | null {
  const payload = parsePayload(heldCartRepo.payloadAsRecord(row.payload));
  if (!payload) return null;
  return {
    id: row.id,
    name: row.name,
    cart: payload.cart,
    customer: payload.customer,
    discountAmount: payload.discountAmount,
    couponCode: payload.couponCode,
    salesMode: payload.salesMode,
    createdAt: row.created_at,
  };
}

export async function listHeldCartsForPosDevice(input: {
  storeId: string;
  deviceId: string;
}): Promise<HeldCart[]> {
  const rows = await heldCartRepo.listHeldCartsForDevice(input);
  return rows
    .map(mapHeldCartRowToHeldCart)
    .filter((cart): cart is HeldCart => cart !== null);
}

export async function createHeldCartForPosDevice(input: {
  storeId: string;
  deviceId: string;
  createdBy: string;
  name: string;
  cart: CartLine[];
  customer: Customer | null;
  discountAmount: number;
  couponCode?: string;
  salesMode: SalesMode;
}): Promise<HeldCart> {
  if (input.cart.length === 0) {
    throw new Error("لا يمكن تعليق سلة فاضية");
  }
  const orgId = await getOrgId();
  const name = input.name.trim() || `Hold ${new Date().toLocaleTimeString("ar-EG")}`;
  const row = await heldCartRepo.insertHeldCart({
    orgId,
    storeId: input.storeId,
    deviceId: input.deviceId,
    createdBy: input.createdBy,
    name,
    payload: {
      cart: input.cart,
      customer: input.customer,
      discountAmount: input.discountAmount,
      couponCode: input.couponCode ?? "",
      salesMode: input.salesMode,
    },
  });
  const mapped = mapHeldCartRowToHeldCart(row);
  if (!mapped) throw new Error("تعذر حفظ الفاتورة المعلّقة");
  return mapped;
}

export async function deleteHeldCartForPosDevice(input: {
  id: string;
  storeId: string;
  deviceId: string;
}): Promise<boolean> {
  return heldCartRepo.deleteHeldCartForDevice(input);
}
