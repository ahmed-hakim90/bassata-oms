import type { Product } from "@/lib/types";

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
  const q = query.trim().toLowerCase();
  
  if (q.length < 1) return [];
  
  // Exact barcode or SKU match takes absolute priority
  const exact = products.find(
    (p) => p.barcode?.toLowerCase() === q || p.sku?.toLowerCase() === q
  );
  
  if (exact) return [exact];
  
  // Fuzzy match: name, barcode, or SKU includes query
  return products
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode?.toLowerCase().includes(q) ?? false) ||
        (p.sku?.toLowerCase().includes(q) ?? false)
    )
    .slice(0, limit);
}
