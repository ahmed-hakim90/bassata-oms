export interface LabelSettings {
  labelWidthMm: number;
  labelHeightMm: number;
  labelGapMm: number;
  pageMarginMm: number;
  showPrice: boolean;
  showSku: boolean;
  defaultCopies: number;
  preset: "thermal_40x30" | "thermal_50x25" | "a4_3x7";
}

export const LABEL_PRESETS: Record<LabelSettings["preset"], Omit<LabelSettings, "preset">> = {
  thermal_40x30: {
    labelWidthMm: 40,
    labelHeightMm: 30,
    labelGapMm: 2,
    pageMarginMm: 2,
    showPrice: true,
    showSku: true,
    defaultCopies: 1,
  },
  thermal_50x25: {
    labelWidthMm: 50,
    labelHeightMm: 25,
    labelGapMm: 2,
    pageMarginMm: 2,
    showPrice: false,
    showSku: true,
    defaultCopies: 1,
  },
  a4_3x7: {
    labelWidthMm: 63.5,
    labelHeightMm: 38.1,
    labelGapMm: 2.5,
    pageMarginMm: 12,
    showPrice: true,
    showSku: true,
    defaultCopies: 1,
  },
};

export const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  preset: "thermal_40x30",
  ...LABEL_PRESETS.thermal_40x30,
};

export function mergeLabelSettings(
  value: Record<string, unknown> | null | undefined
): LabelSettings {
  if (!value) return DEFAULT_LABEL_SETTINGS;
  const preset = (value.preset as LabelSettings["preset"]) ?? DEFAULT_LABEL_SETTINGS.preset;
  const base = LABEL_PRESETS[preset] ?? LABEL_PRESETS.thermal_40x30;
  return {
    preset,
    labelWidthMm: Number(value.labelWidthMm ?? base.labelWidthMm),
    labelHeightMm: Number(value.labelHeightMm ?? base.labelHeightMm),
    labelGapMm: Number(value.labelGapMm ?? base.labelGapMm),
    pageMarginMm: Number(value.pageMarginMm ?? base.pageMarginMm),
    showPrice: value.showPrice !== undefined ? Boolean(value.showPrice) : base.showPrice,
    showSku: value.showSku !== undefined ? Boolean(value.showSku) : base.showSku,
    defaultCopies: Number(value.defaultCopies ?? base.defaultCopies),
  };
}
