import { authenticateSouqnaRequest } from "@/lib/api/souqna-auth";
import { SouqnaApiError, souqnaErrorResponse, souqnaJson } from "@/lib/api/souqna-response";
import { souqnaOrderSchema } from "@/modules/souqna/schemas/souqna-order.schema";
import {
  createSouqnaOrder,
  logSouqnaOrderError,
} from "@/modules/souqna/services/souqna-order.service";
import type { SouqnaAuthContext } from "@/lib/api/souqna-auth";

export async function POST(request: Request) {
  let ctx: SouqnaAuthContext | null = null;
  let body: Record<string, unknown> | null = null;

  try {
    ctx = await authenticateSouqnaRequest(request, { requireOrderImport: true });
    body = (await request.json()) as Record<string, unknown>;
    const parsed = souqnaOrderSchema.safeParse(body);
    if (!parsed.success) {
      throw new SouqnaApiError(422, parsed.error.issues[0]?.message ?? "Invalid payload");
    }

    const result = await createSouqnaOrder(ctx, parsed.data);
    return souqnaJson(result, result.status === "rejected" ? 422 : 200);
  } catch (error) {
    await logSouqnaOrderError(ctx, body, error);
    return souqnaErrorResponse(error);
  }
}
