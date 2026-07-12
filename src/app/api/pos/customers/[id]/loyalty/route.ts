import { NextResponse } from "next/server";
import { AuthError, requirePermissionOrRole } from "@/lib/auth/guards";
import { getCustomerLoyaltyBalance } from "@/modules/loyalty/services/loyalty.service";
import { isFeatureEnabled } from "@/modules/system/services/settings.service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermissionOrRole("checkout_create", ["owner", "manager", "cashier"]);
    const { id } = await context.params;
    if (!(await isFeatureEnabled("loyalty"))) {
      return NextResponse.json({ balance: 0 });
    }
    const balance = await getCustomerLoyaltyBalance(id);
    return NextResponse.json({ balance });
  } catch (error) {
    const status = error instanceof AuthError ? error.status ?? 403 : 500;
    const message =
      error instanceof Error ? error.message : "فشل جلب نقاط الولاء";
    return NextResponse.json({ error: message }, { status });
  }
}
