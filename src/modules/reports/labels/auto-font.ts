import type { LabelContentSettings, LabelSizeSettings } from "@/modules/reports/labels/label-settings";

export type LabelFontMetrics = {
  nameMm: number;
  metaMm: number;
  barcodeHeightPx: number;
  barcodeModuleWidth: number;
  padMm: number;
};

type FontInput = LabelSizeSettings & LabelContentSettings;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function visibleLineCount(
  settings: LabelContentSettings,
  item: { variantName?: string | null }
): number {
  let n = 0;
  if (settings.showName) n += 1;
  if (settings.showVariant && item.variantName) n += 1;
  if (settings.showBarcodeNumber) n += 1;
  if (settings.showSku) n += 1;
  if (settings.showPrice) n += 1;
  return n;
}

/**
 * Auto font size from label geometry + visible fields + name length.
 * Keeps text inside the cell for thermal / A4 presets without manual size picks.
 */
export function computeLabelFontMetrics(
  settings: FontInput,
  item: { productName: string; variantName?: string | null }
): LabelFontMetrics {
  const w = Math.max(20, settings.labelWidthMm);
  const h = Math.max(15, settings.labelHeightMm);
  const lines = Math.max(1, visibleLineCount(settings, item));
  const nameLen = item.productName.trim().length + (item.variantName?.trim().length ?? 0);

  let nameMm = clamp(Math.min(w, h) * 0.09, 1.7, 3.4);
  let metaMm = clamp(Math.min(w, h) * 0.065, 1.3, 2.5);
  let barcodeHeightPx = clamp(h * 1.35, 18, 52);
  let barcodeModuleWidth = w < 45 ? 1.05 : w < 55 ? 1.25 : 1.45;
  let padMm = clamp(Math.min(w, h) * 0.04, 0.6, 1.4);

  if (nameLen > 22) nameMm *= 0.92;
  if (nameLen > 32) nameMm *= 0.88;
  if (nameLen > 44) nameMm *= 0.84;

  if (lines >= 4) {
    nameMm *= 0.9;
    metaMm *= 0.9;
  }
  if (lines >= 5 || (settings.showBarcode && h <= 28)) {
    nameMm *= 0.9;
    metaMm *= 0.88;
    barcodeHeightPx *= 0.82;
  }
  if (!settings.showBarcode) {
    nameMm = clamp(nameMm * 1.08, 1.7, 3.6);
    metaMm = clamp(metaMm * 1.05, 1.3, 2.7);
  }

  if (!settings.autoFontSize) {
    return {
      nameMm: 2.6,
      metaMm: 2,
      barcodeHeightPx: 36,
      barcodeModuleWidth: 1.3,
      padMm: 1,
    };
  }

  return {
    nameMm: clamp(nameMm, 1.5, 3.5),
    metaMm: clamp(metaMm, 1.2, 2.6),
    barcodeHeightPx: clamp(barcodeHeightPx, 16, 56),
    barcodeModuleWidth: clamp(barcodeModuleWidth, 0.9, 1.6),
    padMm: clamp(padMm, 0.5, 1.5),
  };
}
