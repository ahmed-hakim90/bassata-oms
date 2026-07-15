/** Common Egyptian retail weight portions for per-kg POS sales. */
export type WeightPreset = {
  id: string;
  /** Fraction of one kilogram (sale unit = kg). */
  kg: number;
  /** Cashier-facing label. */
  label: string;
};

export const KG_WEIGHT_PRESETS: readonly WeightPreset[] = [
  { id: "1/8", kg: 0.125, label: "١/٨" },
  { id: "1/4", kg: 0.25, label: "١/٤" },
  { id: "1/2", kg: 0.5, label: "١/٢" },
  { id: "3/4", kg: 0.75, label: "٣/٤" },
  { id: "1", kg: 1, label: "١ كيلو" },
] as const;

/** Format preset kg value for the weight input (trim trailing zeros). */
export function formatWeightPresetValue(kg: number): string {
  if (Number.isInteger(kg)) return String(kg);
  return String(Number(kg.toFixed(3)));
}
