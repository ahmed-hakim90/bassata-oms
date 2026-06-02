import type { POSProduct, POSVariant } from "@/modules/pos/services/catalog.service";

export function findPosProductByBarcode(
  products: POSProduct[],
  barcode: string
): { product: POSProduct; variant: POSVariant | null } | null {
  const normalized = barcode.trim();
  if (!normalized) return null;

  for (const product of products) {
    if (!product.hasVariants && product.barcode === normalized) {
      return { product, variant: null };
    }
    for (const variant of product.variants) {
      if (variant.barcode === normalized) {
        return { product, variant };
      }
    }
    if (product.barcode === normalized) {
      return { product, variant: null };
    }
  }
  return null;
}
