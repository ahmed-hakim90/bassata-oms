import type { LabelSettings } from "@/modules/reports/labels/label-settings";
import type { Product, ProductVariant } from "@/lib/types";

/** Product row for Label Studio catalog (server → client). */
export type LabelStudioProduct = Product & {
  variants: ProductVariant[];
};

/** Resolved cart line embedded in the print job (Preview = Print). */
export interface LabelPrintItem {
  /** Stable cart line key (`productId` or `productId:variantId`). */
  id: string;
  productId: string;
  variantId?: string | null;
  productName: string;
  variantName?: string | null;
  barcode: string;
  sku: string;
  price: number | null;
  copies: number;
}

export interface LabelJobSettings {
  preset: LabelSettings["preset"];
  labelWidthMm: number;
  labelHeightMm: number;
  labelGapMm: number;
  pageMarginMm: number;
  showName: boolean;
  showVariant: boolean;
  showBarcode: boolean;
  showBarcodeNumber: boolean;
  showSku: boolean;
  showPrice: boolean;
  autoFontSize: boolean;
}

/** Temporary print job — never loaded from saved org template during print. */
export interface LabelPrintJob {
  currency: string;
  items: LabelPrintItem[];
  settings: LabelJobSettings;
}

export const LABEL_PRINT_STORAGE_KEY = "velora-label-print-job";

export function toLabelJobSettings(settings: LabelSettings): LabelJobSettings {
  return {
    preset: settings.preset,
    labelWidthMm: settings.labelWidthMm,
    labelHeightMm: settings.labelHeightMm,
    labelGapMm: settings.labelGapMm,
    pageMarginMm: settings.pageMarginMm,
    showName: settings.showName,
    showVariant: settings.showVariant,
    showBarcode: settings.showBarcode,
    showBarcodeNumber: settings.showBarcodeNumber,
    showSku: settings.showSku,
    showPrice: settings.showPrice,
    autoFontSize: settings.autoFontSize,
  };
}

export function buildLabelPrintJob(input: {
  currency: string;
  items: LabelPrintItem[];
  settings: LabelSettings;
}): LabelPrintJob {
  return {
    currency: input.currency,
    items: input.items.map((item) => ({
      ...item,
      copies: Math.max(1, Math.floor(item.copies || 1)),
    })),
    settings: toLabelJobSettings(input.settings),
  };
}

export type LabelPrintBlocker = {
  id: string;
  productName: string;
  reason: "missing_barcode" | "missing_sku";
};

export function getLabelPrintBlockers(
  items: LabelPrintItem[],
  settings: Pick<LabelJobSettings, "showBarcode" | "showSku">
): LabelPrintBlocker[] {
  const blockers: LabelPrintBlocker[] = [];
  for (const item of items) {
    if (settings.showBarcode && !item.barcode.trim()) {
      blockers.push({
        id: item.id,
        productName: item.productName,
        reason: "missing_barcode",
      });
    }
    if (settings.showSku && !item.sku.trim()) {
      blockers.push({
        id: item.id,
        productName: item.productName,
        reason: "missing_sku",
      });
    }
  }
  return blockers;
}

export function expandLabelPrintItems(job: LabelPrintJob): LabelPrintItem[] {
  const out: LabelPrintItem[] = [];
  for (const item of job.items) {
    const copies = Math.max(1, Math.floor(item.copies || 1));
    for (let i = 0; i < copies; i++) out.push(item);
  }
  return out;
}

export function isLabelPrintJob(value: unknown): value is LabelPrintJob {
  if (!value || typeof value !== "object") return false;
  const job = value as LabelPrintJob;
  return (
    typeof job.currency === "string" &&
    Array.isArray(job.items) &&
    job.settings != null &&
    typeof job.settings === "object"
  );
}
