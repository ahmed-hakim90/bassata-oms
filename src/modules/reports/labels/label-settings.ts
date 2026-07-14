export type LabelPresetId =
  | "thermal_40x30"
  | "thermal_50x25"
  | "thermal_60x40"
  | "a4_labels"
  | "custom";

/** Org template defaults — used only when opening Label Studio. */
export interface LabelSettings {
  preset: LabelPresetId;
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
  defaultCopies: number;
}

export type LabelContentSettings = Pick<
  LabelSettings,
  | "showName"
  | "showVariant"
  | "showBarcode"
  | "showBarcodeNumber"
  | "showSku"
  | "showPrice"
  | "autoFontSize"
>;

export type LabelSizeSettings = Pick<
  LabelSettings,
  "preset" | "labelWidthMm" | "labelHeightMm" | "labelGapMm" | "pageMarginMm"
>;

type PresetDefaults = Omit<LabelSettings, "preset">;

const CONTENT_ON: Pick<
  PresetDefaults,
  | "showName"
  | "showVariant"
  | "showBarcode"
  | "showBarcodeNumber"
  | "showSku"
  | "showPrice"
  | "autoFontSize"
  | "defaultCopies"
> = {
  showName: true,
  showVariant: true,
  showBarcode: true,
  showBarcodeNumber: true,
  showSku: true,
  showPrice: true,
  autoFontSize: true,
  defaultCopies: 1,
};

export const LABEL_PRESETS: Record<Exclude<LabelPresetId, "custom">, PresetDefaults> = {
  thermal_40x30: {
    labelWidthMm: 40,
    labelHeightMm: 30,
    labelGapMm: 2,
    pageMarginMm: 2,
    ...CONTENT_ON,
  },
  thermal_50x25: {
    labelWidthMm: 50,
    labelHeightMm: 25,
    labelGapMm: 2,
    pageMarginMm: 2,
    ...CONTENT_ON,
    showPrice: false,
  },
  thermal_60x40: {
    labelWidthMm: 60,
    labelHeightMm: 40,
    labelGapMm: 2,
    pageMarginMm: 2,
    ...CONTENT_ON,
  },
  a4_labels: {
    labelWidthMm: 63.5,
    labelHeightMm: 38.1,
    labelGapMm: 2.5,
    pageMarginMm: 12,
    ...CONTENT_ON,
  },
};

export const LABEL_PRESET_OPTIONS: { id: LabelPresetId; label: string }[] = [
  { id: "thermal_40x30", label: "حراري 40×30 مم" },
  { id: "thermal_50x25", label: "حراري 50×25 مم" },
  { id: "thermal_60x40", label: "حراري 60×40 مم" },
  { id: "a4_labels", label: "ملصقات A4" },
  { id: "custom", label: "مقاس مخصص" },
];

export const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  preset: "thermal_40x30",
  ...LABEL_PRESETS.thermal_40x30,
};

function asBool(value: unknown, fallback: boolean): boolean {
  return value !== undefined ? Boolean(value) : fallback;
}

function asNum(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePreset(value: unknown): LabelPresetId {
  if (value === "a4_3x7") return "a4_labels";
  if (
    value === "thermal_40x30" ||
    value === "thermal_50x25" ||
    value === "thermal_60x40" ||
    value === "a4_labels" ||
    value === "custom"
  ) {
    return value;
  }
  return DEFAULT_LABEL_SETTINGS.preset;
}

export function getPresetDefaults(preset: LabelPresetId): PresetDefaults {
  if (preset === "custom") return LABEL_PRESETS.thermal_40x30;
  return LABEL_PRESETS[preset] ?? LABEL_PRESETS.thermal_40x30;
}

export function mergeLabelSettings(
  value: Record<string, unknown> | null | undefined
): LabelSettings {
  if (!value) return DEFAULT_LABEL_SETTINGS;
  const preset = normalizePreset(value.preset);
  const base = getPresetDefaults(preset);
  return {
    preset,
    labelWidthMm: asNum(value.labelWidthMm, base.labelWidthMm),
    labelHeightMm: asNum(value.labelHeightMm, base.labelHeightMm),
    labelGapMm: asNum(value.labelGapMm, base.labelGapMm),
    pageMarginMm: asNum(value.pageMarginMm, base.pageMarginMm),
    showName: asBool(value.showName, base.showName),
    showVariant: asBool(value.showVariant, base.showVariant),
    showBarcode: asBool(value.showBarcode, base.showBarcode),
    showBarcodeNumber: asBool(value.showBarcodeNumber, base.showBarcodeNumber),
    showSku: asBool(value.showSku, base.showSku),
    showPrice: asBool(value.showPrice, base.showPrice),
    autoFontSize: asBool(value.autoFontSize, true),
    defaultCopies: Math.max(1, Math.floor(asNum(value.defaultCopies, base.defaultCopies))),
  };
}

export function applyPreset(preset: LabelPresetId, previous: LabelSettings): LabelSettings {
  if (preset === "custom") {
    return { ...previous, preset: "custom" };
  }
  return {
    preset,
    ...LABEL_PRESETS[preset],
    // Keep user's content toggles when switching size presets
    showName: previous.showName,
    showVariant: previous.showVariant,
    showBarcode: previous.showBarcode,
    showBarcodeNumber: previous.showBarcodeNumber,
    showSku: previous.showSku,
    showPrice: previous.showPrice,
    autoFontSize: previous.autoFontSize,
    defaultCopies: previous.defaultCopies,
  };
}
