-- Pack-aware quantity conversion for wholesale price tiers (piece ↔ carton/pack).
-- convert_unit stays strict for recipes; pricing uses this helper and skips non-convertible tiers.

CREATE OR REPLACE FUNCTION public.convert_quantity_for_pricing(
  p_qty NUMERIC,
  p_from public.measurement_unit,
  p_to public.measurement_unit,
  p_base_unit public.measurement_unit,
  p_pack_unit public.measurement_unit,
  p_units_per_pack NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_factor NUMERIC;
  v_as_base NUMERIC;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_qty IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_from = p_to THEN
    RETURN p_qty;
  END IF;

  -- Metric pairs (same as convert_unit, but NULL instead of raise for pricing filters)
  IF p_from = 'kg' AND p_to = 'gram' THEN RETURN p_qty * 1000; END IF;
  IF p_from = 'gram' AND p_to = 'kg' THEN RETURN p_qty / 1000; END IF;
  IF p_from = 'liter' AND p_to = 'ml' THEN RETURN p_qty * 1000; END IF;
  IF p_from = 'ml' AND p_to = 'liter' THEN RETURN p_qty / 1000; END IF;

  v_factor := COALESCE(NULLIF(p_units_per_pack, 0), NULL);
  IF v_factor IS NULL OR v_factor <= 0 THEN
    RETURN NULL;
  END IF;
  IF p_pack_unit IS NULL OR p_base_unit IS NULL OR p_pack_unit = p_base_unit THEN
    RETURN NULL;
  END IF;
  IF p_pack_unit NOT IN ('carton', 'pack', 'box', 'bag') THEN
    RETURN NULL;
  END IF;

  -- Normalize from → base
  IF p_from = p_base_unit THEN
    v_as_base := p_qty;
  ELSIF p_from = 'kg' AND p_base_unit = 'gram' THEN
    v_as_base := p_qty * 1000;
  ELSIF p_from = 'gram' AND p_base_unit = 'kg' THEN
    v_as_base := p_qty / 1000;
  ELSIF p_from = 'liter' AND p_base_unit = 'ml' THEN
    v_as_base := p_qty * 1000;
  ELSIF p_from = 'ml' AND p_base_unit = 'liter' THEN
    v_as_base := p_qty / 1000;
  ELSIF p_from = p_pack_unit THEN
    v_as_base := p_qty * v_factor;
  ELSE
    RETURN NULL;
  END IF;

  -- Base → to
  IF p_to = p_base_unit THEN
    RETURN v_as_base;
  ELSIF p_base_unit = 'kg' AND p_to = 'gram' THEN
    RETURN v_as_base * 1000;
  ELSIF p_base_unit = 'gram' AND p_to = 'kg' THEN
    RETURN v_as_base / 1000;
  ELSIF p_base_unit = 'liter' AND p_to = 'ml' THEN
    RETURN v_as_base * 1000;
  ELSIF p_base_unit = 'ml' AND p_to = 'liter' THEN
    RETURN v_as_base / 1000;
  ELSIF p_to = p_pack_unit THEN
    RETURN v_as_base / v_factor;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_product_unit_price(
  p_org_id UUID,
  p_product_id UUID,
  p_variant_id UUID,
  p_qty NUMERIC,
  p_sale_unit public.measurement_unit,
  p_sales_mode public.sales_mode,
  p_auto_wholesale BOOLEAN
) RETURNS TABLE (
  unit_price NUMERIC,
  tier_id UUID,
  wholesale_applied BOOLEAN
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_base_price NUMERIC;
  v_product_sale_unit public.measurement_unit;
  v_base_unit public.measurement_unit;
  v_cost_unit public.measurement_unit;
  v_units_per_pack NUMERIC;
  v_sale_unit public.measurement_unit;
  v_effective_mode public.sales_mode;
  v_tier RECORD;
  v_v RECORD;
  v_line_unit_price NUMERIC;
  v_has_packing BOOLEAN;
BEGIN
  SELECT
    p.base_price,
    p.sale_unit,
    COALESCE(p.base_unit, p.unit),
    p.cost_unit,
    COALESCE(NULLIF(p.units_per_purchase_unit, 0), 1)
  INTO
    v_base_price,
    v_product_sale_unit,
    v_base_unit,
    v_cost_unit,
    v_units_per_pack
  FROM products p
  WHERE p.id = p_product_id AND p.org_id = p_org_id;

  v_sale_unit := COALESCE(p_sale_unit, v_product_sale_unit);
  v_has_packing :=
    v_cost_unit IN ('carton', 'pack', 'box', 'bag')
    AND v_cost_unit IS DISTINCT FROM v_base_unit
    AND v_units_per_pack > 0;

  v_line_unit_price := v_base_price;
  tier_id := NULL;
  wholesale_applied := false;

  IF p_variant_id IS NOT NULL THEN
    SELECT pv.variant_kind, pv.price_mode, pv.fixed_price, pv.quantity_value, pv.quantity_unit,
           pv.price_delta,
           pv.price
    INTO v_v
    FROM product_variants pv
    WHERE pv.id = p_variant_id AND pv.product_id = p_product_id;

    IF v_v.variant_kind = 'weight_portion' THEN
      IF v_v.price_mode = 'fixed_price' AND v_v.fixed_price IS NOT NULL THEN
        v_line_unit_price := v_v.fixed_price / NULLIF(p_qty, 0);
      ELSIF v_v.quantity_value IS NOT NULL AND v_v.quantity_unit IS NOT NULL THEN
        v_line_unit_price := v_base_price * convert_unit(
          v_v.quantity_value,
          v_v.quantity_unit,
          v_sale_unit
        ) / NULLIF(p_qty, 0);
      END IF;
      unit_price := v_line_unit_price;
      RETURN NEXT;
      RETURN;
    END IF;

    v_line_unit_price := COALESCE(v_v.price, v_base_price + COALESCE(v_v.price_delta, 0));
  END IF;

  v_effective_mode := p_sales_mode;
  IF p_auto_wholesale AND p_sales_mode = 'retail' THEN
    SELECT t.id, t.price, t.sale_mode, t.min_quantity, t.unit
    INTO v_tier
    FROM product_price_tiers t
    WHERE t.org_id = p_org_id
      AND t.product_id = p_product_id
      AND (t.variant_id IS NOT DISTINCT FROM p_variant_id)
      AND t.active = true
      AND t.sale_mode = 'wholesale'
      AND public.convert_quantity_for_pricing(
        p_qty,
        v_sale_unit,
        t.unit,
        v_base_unit,
        CASE WHEN v_has_packing THEN v_cost_unit ELSE v_base_unit END,
        CASE WHEN v_has_packing THEN v_units_per_pack ELSE 1 END
      ) >= t.min_quantity
    ORDER BY COALESCE(
      public.convert_quantity_for_pricing(
        t.min_quantity,
        t.unit,
        v_sale_unit,
        v_base_unit,
        CASE WHEN v_has_packing THEN v_cost_unit ELSE v_base_unit END,
        CASE WHEN v_has_packing THEN v_units_per_pack ELSE 1 END
      ),
      t.min_quantity
    ) DESC
    LIMIT 1;

    IF FOUND THEN
      v_effective_mode := 'wholesale';
    END IF;
  END IF;

  SELECT t.id, t.price, t.sale_mode
  INTO v_tier
  FROM product_price_tiers t
  WHERE t.org_id = p_org_id
    AND t.product_id = p_product_id
    AND (t.variant_id IS NOT DISTINCT FROM p_variant_id)
    AND t.active = true
    AND t.sale_mode = v_effective_mode
    AND public.convert_quantity_for_pricing(
      p_qty,
      v_sale_unit,
      t.unit,
      v_base_unit,
      CASE WHEN v_has_packing THEN v_cost_unit ELSE v_base_unit END,
      CASE WHEN v_has_packing THEN v_units_per_pack ELSE 1 END
    ) >= t.min_quantity
  ORDER BY COALESCE(
    public.convert_quantity_for_pricing(
      t.min_quantity,
      t.unit,
      v_sale_unit,
      v_base_unit,
      CASE WHEN v_has_packing THEN v_cost_unit ELSE v_base_unit END,
      CASE WHEN v_has_packing THEN v_units_per_pack ELSE 1 END
    ),
    t.min_quantity
  ) DESC
  LIMIT 1;

  IF FOUND THEN
    unit_price := v_tier.price;
    tier_id := v_tier.id;
    wholesale_applied := (v_tier.sale_mode = 'wholesale');
  ELSE
    unit_price := v_line_unit_price;
  END IF;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_quantity_for_pricing(
  NUMERIC,
  public.measurement_unit,
  public.measurement_unit,
  public.measurement_unit,
  public.measurement_unit,
  NUMERIC
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.resolve_product_unit_price(
  UUID, UUID, UUID, NUMERIC, public.measurement_unit, public.sales_mode, BOOLEAN
) TO authenticated;
