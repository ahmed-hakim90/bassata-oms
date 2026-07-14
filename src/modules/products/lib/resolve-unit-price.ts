import {
  convertQuantityForPricing,
  type PricingPacking,
} from "@/lib/units";
import type { MeasurementUnit, ProductPriceTier, SalesMode } from "@/lib/types";

/** Pure tier resolution — safe for client and server. */
export function resolveUnitPrice(params: {
  basePrice: number;
  quantity: number;
  saleUnit: MeasurementUnit;
  saleMode: SalesMode;
  autoApplyWholesale: boolean;
  tiers: ProductPriceTier[];
  /** Purchase packing (carton/pack) so piece↔carton tier thresholds convert correctly. */
  packing?: PricingPacking | null;
}) {
  const {
    basePrice,
    quantity,
    saleUnit,
    saleMode,
    autoApplyWholesale,
    tiers,
    packing = null,
  } = params;
  const byMode = tiers.filter((t) => t.active && t.sale_mode === saleMode);
  let candidates = byMode;
  if (saleMode === "retail" && autoApplyWholesale) {
    candidates = tiers.filter((t) => t.active);
  }

  const eligible = candidates
    .map((tier) => {
      const qtyInTierUnit = convertQuantityForPricing({
        quantity,
        from: saleUnit,
        to: tier.unit,
        packing,
      });
      if (qtyInTierUnit == null || qtyInTierUnit < tier.min_quantity) return null;

      // Prefer higher minimum expressed in sale units (fair across piece vs carton tiers).
      const minInSaleUnit =
        convertQuantityForPricing({
          quantity: tier.min_quantity,
          from: tier.unit,
          to: saleUnit,
          packing,
        }) ?? tier.min_quantity;

      return { tier, minInSaleUnit };
    })
    .filter((row): row is { tier: ProductPriceTier; minInSaleUnit: number } => row != null)
    .sort((a, b) => b.minInSaleUnit - a.minInSaleUnit);

  const matched = eligible[0]?.tier;
  if (!matched) {
    return { unitPrice: basePrice, tierId: null as string | null, wholesaleApplied: false };
  }
  return {
    unitPrice: matched.price,
    tierId: matched.id,
    wholesaleApplied: matched.sale_mode === "wholesale" || saleMode === "wholesale",
  };
}
