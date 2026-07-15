import type { CostCenterType } from "@/lib/constants";

/** Arabic operator labels for cost center type enums (values stay English in DB). */
export const COST_CENTER_TYPE_LABELS: Record<CostCenterType, string> = {
  operations: "تشغيل",
  cleaning: "نظافة",
  utilities: "مرافق",
  packaging: "تعبئة وتغليف",
  maintenance: "صيانة",
  salaries: "رواتب",
  marketing: "تسويق",
  other: "أخرى",
};

export function labelCostCenterType(type: CostCenterType): string {
  return COST_CENTER_TYPE_LABELS[type] ?? type;
}
