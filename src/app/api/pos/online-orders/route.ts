import { NextResponse } from "next/server";
import { AuthError, requirePermissionOrRole } from "@/lib/auth/guards";
import { requirePosAccess } from "@/lib/auth/pos-access";
import { listActiveOnlineOrdersWithItems } from "@/modules/online-orders/services/online-order.service";

export const dynamic = "force-dynamic";

/** Active online orders for POS without remounting the page. */
export async function GET() {
  try {
    await requirePermissionOrRole("checkout_create", ["owner", "manager", "cashier"]);
    const ctx = await requirePosAccess({ touchSeen: false });
    const orders = await listActiveOnlineOrdersWithItems(ctx.storeId);
    return NextResponse.json({
      storeId: ctx.storeId,
      orders,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status ?? 403 : 500;
    const message =
      error instanceof Error ? error.message : "فشل تحميل الطلبات الأونلاين";
    return NextResponse.json({ error: message }, { status });
  }
}
