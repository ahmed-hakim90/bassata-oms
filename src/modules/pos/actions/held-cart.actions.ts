"use server";

import { requirePermissionOrRole } from "@/lib/auth/guards";
import { requirePosAccess } from "@/lib/auth/pos-access";
import type { SalesMode } from "@/lib/constants";
import type { CartLine, Customer } from "@/lib/types";
import {
  createHeldCartForPosDevice,
  deleteHeldCartForPosDevice,
  listHeldCartsForPosDevice,
} from "@/modules/pos/services/held-cart.service";
import type { HeldCart } from "@/stores/pos-store";

export type HeldCartActionResult =
  | { success: true; heldCart: HeldCart }
  | { success: false; error: string };

export type HeldCartListResult =
  | { success: true; heldCarts: HeldCart[] }
  | { success: false; error: string };

export type HeldCartDeleteResult =
  | { success: true }
  | { success: false; error: string };

export async function listHeldCartsAction(): Promise<HeldCartListResult> {
  try {
    await requirePermissionOrRole("pos_access", ["owner", "manager", "cashier"]);
    const ctx = await requirePosAccess({ touchSeen: false });
    const heldCarts = await listHeldCartsForPosDevice({
      storeId: ctx.storeId,
      deviceId: ctx.deviceId,
    });
    return { success: true, heldCarts };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "تعذر تحميل الفواتير المعلّقة",
    };
  }
}

export async function holdCartAction(input: {
  name?: string;
  cart: CartLine[];
  customer: Customer | null;
  discountAmount: number;
  salesMode: SalesMode;
}): Promise<HeldCartActionResult> {
  try {
    await requirePermissionOrRole("pos_access", ["owner", "manager", "cashier"]);
    const ctx = await requirePosAccess({ touchSeen: false });
    const heldCart = await createHeldCartForPosDevice({
      storeId: ctx.storeId,
      deviceId: ctx.deviceId,
      createdBy: ctx.user.id,
      name: input.name?.trim() || input.customer?.name || "فاتورة معلّقة",
      cart: input.cart,
      customer: input.customer,
      discountAmount: input.discountAmount,
      salesMode: input.salesMode,
    });
    return { success: true, heldCart };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "تعذر تعليق الفاتورة",
    };
  }
}

export async function discardHeldCartAction(id: string): Promise<HeldCartDeleteResult> {
  try {
    await requirePermissionOrRole("pos_access", ["owner", "manager", "cashier"]);
    const ctx = await requirePosAccess({ touchSeen: false });
    const deleted = await deleteHeldCartForPosDevice({
      id,
      storeId: ctx.storeId,
      deviceId: ctx.deviceId,
    });
    if (!deleted) {
      return { success: false, error: "الفاتورة المعلّقة غير موجودة" };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "تعذر حذف الفاتورة المعلّقة",
    };
  }
}

/** Resume: optionally park current cart, then remove the resumed hold from the server. */
export async function resumeHeldCartAction(input: {
  resumeId: string;
  parkCurrent?: {
    name?: string;
    cart: CartLine[];
    customer: Customer | null;
    discountAmount: number;
    salesMode: SalesMode;
  } | null;
}): Promise<
  | { success: true; parked: HeldCart | null }
  | { success: false; error: string }
> {
  try {
    await requirePermissionOrRole("pos_access", ["owner", "manager", "cashier"]);
    const ctx = await requirePosAccess({ touchSeen: false });

    let parked: HeldCart | null = null;
    if (input.parkCurrent && input.parkCurrent.cart.length > 0) {
      parked = await createHeldCartForPosDevice({
        storeId: ctx.storeId,
        deviceId: ctx.deviceId,
        createdBy: ctx.user.id,
        name:
          input.parkCurrent.name?.trim() ||
          input.parkCurrent.customer?.name ||
          "فاتورة معلّقة",
        cart: input.parkCurrent.cart,
        customer: input.parkCurrent.customer,
        discountAmount: input.parkCurrent.discountAmount,
        salesMode: input.parkCurrent.salesMode,
      });
    }

    const deleted = await deleteHeldCartForPosDevice({
      id: input.resumeId,
      storeId: ctx.storeId,
      deviceId: ctx.deviceId,
    });
    if (!deleted) {
      return { success: false, error: "الفاتورة المعلّقة غير موجودة" };
    }

    return { success: true, parked };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "تعذر استئناف الفاتورة المعلّقة",
    };
  }
}
