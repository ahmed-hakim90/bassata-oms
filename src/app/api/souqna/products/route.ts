import { authenticateSouqnaRequest } from "@/lib/api/souqna-auth";
import { souqnaErrorResponse, souqnaJson, SouqnaApiError } from "@/lib/api/souqna-response";
import { souqnaProductsQuerySchema } from "@/modules/souqna/schemas/souqna-products.schema";
import {
  listSouqnaProducts,
  logSouqnaProductsError,
} from "@/modules/souqna/services/souqna-product.service";
import type { SouqnaAuthContext } from "@/lib/api/souqna-auth";

export async function GET(request: Request) {
  let ctx: SouqnaAuthContext | null = null;
  const queryParams = Object.fromEntries(new URL(request.url).searchParams.entries());

  try {
    ctx = await authenticateSouqnaRequest(request);
    const query = souqnaProductsQuerySchema.parse(queryParams);
    if (query.updated_after && Number.isNaN(Date.parse(query.updated_after))) {
      throw new SouqnaApiError(422, "Invalid updated_after datetime");
    }
    const result = await listSouqnaProducts(ctx, query);
    return souqnaJson(result);
  } catch (error) {
    await logSouqnaProductsError(ctx, queryParams, error);
    return souqnaErrorResponse(error);
  }
}
