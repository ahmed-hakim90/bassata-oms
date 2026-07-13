import type {
  ExpiryPolicy,
  InventoryRotationMethod,
  InventoryTrackingMode,
  ShelfLifeUnit,
} from "@/lib/constants";
import type { ProductType } from "@/lib/constants";

/** Arabic operator labels for inventory enums (values stay English in DB). */
export const INVENTORY_TRACKING_MODE_LABELS: Record<InventoryTrackingMode, string> = {
  none: "بدون تتبع",
  standard: "عادي",
  batch: "بالدفعات",
  batch_and_expiry: "دفعات وتواريخ صلاحية",
  serial_number: "رقم تسلسلي",
};

export const INVENTORY_ROTATION_METHOD_LABELS: Record<InventoryRotationMethod, string> = {
  FIFO: "الأقدم أولاً",
  FEFO: "الأقرب لانتهاء الصلاحية أولاً",
  MANUAL: "يدوي",
};

export const EXPIRY_POLICY_LABELS: Record<ExpiryPolicy, string> = {
  block_sale: "منع البيع بعد الانتهاء",
  warn_only: "تحذير فقط",
  manager_override: "يتطلب موافقة مدير",
};

export const SHELF_LIFE_UNIT_LABELS: Record<ShelfLifeUnit, string> = {
  days: "أيام",
  months: "شهور",
  years: "سنوات",
};

export const PRODUCT_TYPE_LABELS: Partial<Record<ProductType, string>> = {
  finished_product: "منتج بيع",
  finished: "منتج وزني",
  packaging_material: "مواد تعبئة",
  service: "خدمة",
  ingredient: "مكوّن",
  raw_material: "مادة خام",
  consumable: "استهلاكي",
  semi_finished: "نصف جاهز",
  asset: "أصل",
};

export function labelProductType(type: ProductType): string {
  return PRODUCT_TYPE_LABELS[type] ?? type;
}
