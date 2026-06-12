import type { ProductFormValues } from "@/modules/products/components/product-form-dialog";

const FIELDS_BY_STEP: Record<number, Array<keyof ProductFormValues>> = {
  1: ["name", "category_id", "image_url"],
  2: ["product_type", "sales_unit_type"],
  3: ["base_price", "sale_price"],
  4: ["track_inventory", "expiry_tracking_enabled"],
};

export function getProductFormStepForField(
  field: keyof ProductFormValues
): number | undefined {
  for (const [step, fields] of Object.entries(FIELDS_BY_STEP)) {
    if (fields.includes(field)) return Number(step);
  }
  return undefined;
}

export function getProductFormFieldsForStep(step: number): Array<keyof ProductFormValues> {
  return FIELDS_BY_STEP[step] ?? [];
}

export function getFirstProductFormErrorStep(
  errors: Partial<Record<keyof ProductFormValues, unknown>>
): number | undefined {
  for (const field of Object.keys(errors) as Array<keyof ProductFormValues>) {
    const step = getProductFormStepForField(field);
    if (step !== undefined) return step;
  }
  return undefined;
}
