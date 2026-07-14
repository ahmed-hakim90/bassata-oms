import { describe, expect, it } from "vitest";
import {
  DEFAULT_LABEL_SETTINGS,
  LABEL_PRESETS,
  applyPreset,
  mergeLabelSettings,
} from "@/modules/reports/labels/label-settings";
import { computeLabelFontMetrics } from "@/modules/reports/labels/auto-font";
import {
  buildLabelPrintJob,
  expandLabelPrintItems,
  getLabelPrintBlockers,
} from "@/modules/reports/labels/print-job";

describe("label settings", () => {
  it("merges saved settings over preset defaults", () => {
    const merged = mergeLabelSettings({
      preset: "thermal_60x40",
      showPrice: false,
      showBarcodeNumber: false,
    });
    expect(merged.preset).toBe("thermal_60x40");
    expect(merged.labelWidthMm).toBe(LABEL_PRESETS.thermal_60x40.labelWidthMm);
    expect(merged.showPrice).toBe(false);
    expect(merged.showBarcodeNumber).toBe(false);
    expect(merged.autoFontSize).toBe(true);
  });

  it("migrates legacy a4_3x7 preset key", () => {
    expect(mergeLabelSettings({ preset: "a4_3x7" }).preset).toBe("a4_labels");
  });

  it("keeps content toggles when switching size presets", () => {
    const previous = {
      ...DEFAULT_LABEL_SETTINGS,
      showPrice: false,
      showSku: false,
    };
    const next = applyPreset("thermal_60x40", previous);
    expect(next.labelWidthMm).toBe(60);
    expect(next.showPrice).toBe(false);
    expect(next.showSku).toBe(false);
  });
});

describe("label print job", () => {
  it("embeds settings snapshot so print ignores org template", () => {
    const job = buildLabelPrintJob({
      currency: "EGP",
      settings: { ...DEFAULT_LABEL_SETTINGS, showPrice: false },
      items: [
        {
          id: "p1",
          productId: "p1",
          productName: "جبنة",
          barcode: "123",
          sku: "SKU-1",
          price: 10,
          copies: 3,
        },
      ],
    });
    expect(job.settings.showPrice).toBe(false);
    expect(expandLabelPrintItems(job)).toHaveLength(3);
  });

  it("blocks print only when barcode is required but missing", () => {
    const items = [
      {
        id: "a",
        productId: "a",
        productName: "بدون باركود",
        barcode: "",
        sku: "",
        price: 1,
        copies: 1,
      },
    ];
    const blockers = getLabelPrintBlockers(items, {
      showBarcode: true,
      showSku: true,
    });
    expect(blockers.some((b) => b.reason === "missing_barcode")).toBe(true);
    expect(blockers.some((b) => b.reason === "missing_sku")).toBe(true);

    const ok = getLabelPrintBlockers(items, {
      showBarcode: false,
      showSku: false,
    });
    expect(ok).toHaveLength(0);
  });
});

describe("auto font", () => {
  it("shrinks name size for long product names on small labels", () => {
    const base = {
      ...DEFAULT_LABEL_SETTINGS,
      labelWidthMm: 40,
      labelHeightMm: 30,
    };
    const short = computeLabelFontMetrics(base, { productName: "لبن" });
    const long = computeLabelFontMetrics(base, {
      productName: "موتزاريلا جولد اخضر طبيعي عبوة كبيرة جدًا",
    });
    expect(long.nameMm).toBeLessThan(short.nameMm);
  });
});
