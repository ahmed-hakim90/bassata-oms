import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/guards";
import {
  executePosCheckout,
  type CheckoutFlowInput,
} from "@/modules/pos/services/pos-checkout-flow.service";

export const dynamic = "force-dynamic";

/** Checkout without remounting the POS RSC tree. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutFlowInput;
    const result = await executePosCheckout(body);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AuthError ? error.status ?? 403 : 500;
    const message = error instanceof Error ? error.message : "فشل إتمام البيع";
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
