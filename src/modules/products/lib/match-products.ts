import type { Product } from "@/lib/types";

/** Exact barcode or SKU match (case-insensitive). HID scanners send this. */
export function findProductByCode(
  products: readonly Product[],
  code: string
): Product | undefined {
  const q = code.trim().toLowerCase();
  if (!q) return undefined;
  return products.find(
    (p) => p.barcode?.toLowerCase() === q || p.sku?.toLowerCase() === q
  );
}

/** True when name, barcode, or SKU contains the query. Empty query matches all. */
export function productMatchesQuery(product: Product, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    product.name.toLowerCase().includes(q) ||
    (product.barcode?.toLowerCase().includes(q) ?? false) ||
    (product.sku?.toLowerCase().includes(q) ?? false)
  );
}

/**
 * Match products by barcode/SKU/name with exact barcode/SKU priority.
 * Returns up to `limit` matches (default 8).
 */
export function matchProducts(
  products: Product[],
  query: string,
  options?: { limit?: number }
): Product[] {
  const limit = options?.limit ?? 8;
  const q = query.trim();
  if (q.length < 1) return [];

  const exact = findProductByCode(products, q);
  if (exact) return [exact];

  return products.filter((p) => productMatchesQuery(p, q)).slice(0, limit);
}
