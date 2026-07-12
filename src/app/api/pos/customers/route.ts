import { NextResponse } from "next/server";
import { AuthError, requirePermissionOrRole } from "@/lib/auth/guards";
import {
  quickCreateCustomer,
  searchCustomersForPOS,
} from "@/modules/pos/services/customer-attach.service";
import { getCustomerLoyaltyBalances } from "@/modules/loyalty/services/loyalty.service";
import { isFeatureEnabled } from "@/modules/system/services/settings.service";

export const dynamic = "force-dynamic";

/** Search customers without remounting the POS RSC tree (server actions do). */
export async function GET(request: Request) {
  try {
    await requirePermissionOrRole("checkout_create", ["owner", "manager", "cashier"]);
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (query.length < 3) {
      return NextResponse.json({ customers: [] });
    }

    const customers = await searchCustomersForPOS(query);
    const loyaltyOn = await isFeatureEnabled("loyalty");
    if (!loyaltyOn || customers.length === 0) {
      return NextResponse.json({
        customers: customers.map((c) => ({ ...c, loyalty_balance: null })),
      });
    }

    const balances = await getCustomerLoyaltyBalances(customers.map((c) => c.id));
    return NextResponse.json({
      customers: customers.map((c) => ({
        ...c,
        loyalty_balance: balances.get(c.id) ?? 0,
      })),
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status ?? 403 : 500;
    const message =
      error instanceof Error ? error.message : "فشل البحث عن العملاء";
    return NextResponse.json({ error: message }, { status });
  }
}

/** Create + attach customer without remounting the POS RSC tree. */
export async function POST(request: Request) {
  try {
    const user = await requirePermissionOrRole("customer_manage", [
      "owner",
      "manager",
      "cashier",
    ]);
    const body = (await request.json()) as { name?: string; phone?: string };
    const name = body.name?.trim() ?? "";
    const phone = body.phone?.trim() ?? "";
    if (!name) {
      return NextResponse.json({ error: "اكتب اسم العميل" }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: "اكتب رقم الهاتف" }, { status: 400 });
    }

    const created = await quickCreateCustomer({
      name,
      phone,
      userId: user.id,
    });
    return NextResponse.json({ customer: { ...created, loyalty_balance: 0 } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Phone number already registered")) {
      return NextResponse.json({ error: "رقم الهاتف مسجل من قبل" }, { status: 409 });
    }
    const status = error instanceof AuthError ? error.status ?? 403 : 500;
    return NextResponse.json(
      { error: message || "فشل إضافة العميل" },
      { status }
    );
  }
}
