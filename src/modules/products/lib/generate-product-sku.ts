export const DEFAULT_PRODUCT_SKU_PREFIX = "PRD";
const SKU_PAD_LENGTH = 4;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sequentialSkuPattern(prefix: string): RegExp {
  return new RegExp(`^${escapeRegExp(prefix)}-(\\d+)$`, "i");
}

/** Next generic SKU: PRD-0001, PRD-0002, … based on existing codes with the same prefix. */
export function nextSequentialProductSku(
  existingSkus: string[],
  prefix: string = DEFAULT_PRODUCT_SKU_PREFIX
): string {
  const normalizedPrefix = prefix.trim().toUpperCase() || DEFAULT_PRODUCT_SKU_PREFIX;
  const pattern = sequentialSkuPattern(normalizedPrefix);
  let max = 0;

  for (const sku of existingSkus) {
    const match = sku.trim().match(pattern);
    if (!match) continue;
    const value = Number.parseInt(match[1], 10);
    if (!Number.isNaN(value) && value > max) max = value;
  }

  const next = max + 1;
  return `${normalizedPrefix}-${String(next).padStart(SKU_PAD_LENGTH, "0")}`;
}

/** @deprecated Use nextSequentialProductSku */
export function generateProductSku(existingSkus: string[] = []): string {
  return nextSequentialProductSku(existingSkus);
}
