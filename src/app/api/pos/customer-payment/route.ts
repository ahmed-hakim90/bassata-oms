import { NextResponse } from "next/server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { AuthError, requirePermissionOrRole, getValidatedActiveStoreId } from "@/lib/auth/guards";
import { recordCustomerPayment } from "@/modules/customers/services/customer-account.service";
import type { PaymentMethod } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Record customer payment without remounting the POS RSC tree. */
export async function POST(request: Request) {
  try {
    const user = await requirePermissionOrRole("customer_payment_receive", [
      "owner",
      "manager",
      "cashier",
    ]);
    const body = (await request.json()) as {
      customerId?: string;
      amount?: number;
      paymentMethod?: PaymentMethod;
      reference?: string;
      notes?: string;
    };

    if (!body.customerId) {
      return NextResponse.json(
        { success: false, error: "العميل مطلوب" },
        { status: 400 }
      );
    }
    if (!(typeof body.amount === "number" && body.amount > 0 && Number.isFinite(body.amount))) {
      return NextResponse.json(
        { success: false, error: "أدخل مبلغ تحصيل صحيح" },
        { status: 400 }
      );
    }
    if (!body.paymentMethod) {
      return NextResponse.json(
        { success: false, error: "طريقة الدفع مطلوبة" },
        { status: 400 }
      );
    }

    const storeId = await getValidatedActiveStoreId();
    await recordCustomerPayment({
      customerId: body.customerId,
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      reference: body.reference,
      notes: body.notes,
      storeId,
      userId: user.id,
    });

    after(() => {
      revalidatePath("/customers");
      revalidatePath(`/customers/${body.customerId}`);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const status = error instanceof AuthError ? error.status ?? 403 : 500;
    const message =
      error instanceof Error ? error.message : "تعذر تسجيل التحصيل";
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
