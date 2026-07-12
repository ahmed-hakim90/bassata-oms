import { NextResponse } from "next/server";
import { AuthError, requirePermissionOrRole } from "@/lib/auth/guards";
import { requirePosAccess } from "@/lib/auth/pos-access";
import {
  getCategoriesForPOS,
  getProductsForPOS,
} from "@/modules/pos/services/catalog.service";

export const dynamic = "force-dynamic";

/** Catalog for POS without remounting the page RSC tree. */
export async function GET() {
  try {
    await requirePermissionOrRole("checkout_create", ["owner", "manager", "cashier"]);
    const ctx = await requirePosAccess({ touchSeen: false });
    const [categories, products] = await Promise.all([
      getCategoriesForPOS(),
      getProductsForPOS(ctx.storeId),
    ]);
    return NextResponse.json({
      storeId: ctx.storeId,
      categories,
      products,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status ?? 403 : 500;
    const message =
      error instanceof Error ? error.message : "فشل تحميل قائمة المنتجات";
    return NextResponse.json({ error: message }, { status });
  }
}
