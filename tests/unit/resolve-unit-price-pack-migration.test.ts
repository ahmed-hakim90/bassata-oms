import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260714200245_resolve_product_unit_price_pack_conversion.sql"
  ),
  "utf8"
);

describe("resolve_product_unit_price pack conversion migration", () => {
  it("adds convert_quantity_for_pricing helper", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.convert_quantity_for_pricing"
    );
    expect(migration).toContain("p_units_per_pack NUMERIC");
    expect(migration).toContain("'carton', 'pack', 'box', 'bag'");
  });

  it("uses packing fields from products in resolve_product_unit_price", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.resolve_product_unit_price");
    expect(migration).toContain("units_per_purchase_unit");
    expect(migration).toContain("convert_quantity_for_pricing");
    expect(migration).toContain("v_has_packing");
  });

  it("does not weaken strict convert_unit used by recipes", () => {
    expect(migration).not.toContain("CREATE OR REPLACE FUNCTION convert_unit");
    expect(migration).not.toContain("CREATE OR REPLACE FUNCTION public.convert_unit");
  });
});
