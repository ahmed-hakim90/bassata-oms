"use server";

import { requireFeature, requirePermissionOrRole } from "@/lib/auth/guards";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import { getPurchase } from "@/modules/purchases/services/purchase.service";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";
import {
  buildRowsFromProducts,
  buildRowsFromPurchaseLines,
  type PriceListRow,
} from "@/modules/price-lists/lib/build-price-list-rows";
import type { Product } from "@/lib/types";
import type { ReportBranding } from "@/modules/reports/core/report-context";

export type PriceListActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type PriceListStudioData = {
  source: "invoice" | "products";
  invoiceId: string | null;
  invoiceNumber: string | null;
  rows: PriceListRow[];
  branding: ReportBranding;
  catalog: Product[];
  defaultMarginPercent: number;
};

async function assertPriceListAccess() {
  await requireFeature("purchases");
  await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
}

function actionError(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

export async function getPriceListStudioDataAction(input: {
  invoiceId?: string | null;
  productIds?: string[] | null;
  marginPercent?: number;
}): Promise<PriceListActionResult<PriceListStudioData>> {
  try {
    await assertPriceListAccess();
    const marginPercent =
      input.marginPercent != null && Number.isFinite(input.marginPercent)
        ? input.marginPercent
        : 5;

    const catalog = (await catalogRepo.listProducts()).filter((p) => p.is_active);
    const productsById = new Map(catalog.map((p) => [p.id, p]));

    if (input.invoiceId) {
      const purchase = await getPurchase(input.invoiceId);
      if (!purchase) throw new Error("فاتورة الشراء غير موجودة");
      const branding = await getReportBranding(purchase.store_id);
      const rows = buildRowsFromPurchaseLines({
        lines: purchase.lines,
        productsById,
        marginPercent,
      });
      return {
        ok: true,
        data: {
          source: "invoice",
          invoiceId: purchase.id,
          invoiceNumber: purchase.invoice_number,
          rows,
          branding,
          catalog,
          defaultMarginPercent: marginPercent,
        },
      };
    }

    const ids = (input.productIds ?? []).filter(Boolean);
    const selected =
      ids.length > 0
        ? ids.map((id) => productsById.get(id)).filter((p): p is Product => !!p)
        : [];

    const branding = await getReportBranding();
    const rows = buildRowsFromProducts({ products: selected, marginPercent });

    return {
      ok: true,
      data: {
        source: "products",
        invoiceId: null,
        invoiceNumber: null,
        rows,
        branding,
        catalog,
        defaultMarginPercent: marginPercent,
      },
    };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}
