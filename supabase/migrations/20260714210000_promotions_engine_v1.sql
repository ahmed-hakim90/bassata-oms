-- Promotions engine V1: rules, evaluation RPC, checkout wiring, flags & permissions

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.promotion_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'percent_off_item',
    'fixed_off_item',
    'scheduled_sale_price',
    'cart_percent',
    'cart_fixed',
    'bogo',
    'qty_threshold'
  )),
  priority INT NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  store_ids UUID[],
  sale_modes TEXT[] NOT NULL DEFAULT ARRAY['retail', 'wholesale']::text[],
  coupon_code TEXT,
  stackable_with_cart BOOLEAN NOT NULL DEFAULT false,
  min_subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (min_subtotal >= 0),
  scope_type TEXT NOT NULL DEFAULT 'all' CHECK (scope_type IN ('all', 'product', 'category')),
  scope_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  usage_limit_total INT CHECK (usage_limit_total IS NULL OR usage_limit_total >= 0),
  usage_count INT NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT promotion_rules_sale_modes_valid CHECK (
    sale_modes <@ ARRAY['retail', 'wholesale']::text[]
  )
);

CREATE INDEX IF NOT EXISTS idx_promotion_rules_org_active
  ON public.promotion_rules (org_id, is_active, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_promotion_rules_org_coupon
  ON public.promotion_rules (org_id, upper(coupon_code))
  WHERE coupon_code IS NOT NULL;

ALTER TABLE public.promotion_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promotion_rules_org_select ON public.promotion_rules;
CREATE POLICY promotion_rules_org_select ON public.promotion_rules
  FOR SELECT USING (org_id = auth_org_id());

DROP POLICY IF EXISTS promotion_rules_org_write ON public.promotion_rules;
CREATE POLICY promotion_rules_org_write ON public.promotion_rules
  FOR ALL USING (org_id = auth_org_id()) WITH CHECK (org_id = auth_org_id());

CREATE TABLE IF NOT EXISTS public.order_promotion_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  promotion_rule_id UUID REFERENCES public.promotion_rules(id) ON DELETE SET NULL,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
  level TEXT NOT NULL CHECK (level IN ('item', 'cart')),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  rule_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_promo_apps_order
  ON public.order_promotion_applications (order_id);

ALTER TABLE public.order_promotion_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_promo_apps_select ON public.order_promotion_applications;
CREATE POLICY order_promo_apps_select ON public.order_promotion_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.stores s ON s.id = o.store_id
      WHERE o.id = order_id AND s.org_id = auth_org_id()
    )
  );

DROP POLICY IF EXISTS order_promo_apps_insert ON public.order_promotion_applications;
CREATE POLICY order_promo_apps_insert ON public.order_promotion_applications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.stores s ON s.id = o.store_id
      WHERE o.id = order_id AND s.org_id = auth_org_id()
    )
  );

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS list_unit_price NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promotion_rule_id UUID REFERENCES public.promotion_rules(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS promo_discount NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.online_order_items
  ADD COLUMN IF NOT EXISTS list_unit_price NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promotion_rule_id UUID REFERENCES public.promotion_rules(id) ON DELETE SET NULL;

ALTER TABLE public.online_orders
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS promo_discount NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Feature flag + permission
-- ---------------------------------------------------------------------------

UPDATE public.app_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object('promotions', false)
WHERE key = 'feature_flags'
  AND NOT (COALESCE(value, '{}'::jsonb) ? 'promotions');

INSERT INTO public.permissions (key, label, description, group_name) VALUES
  ('manage_promotions', 'Manage promotions', 'Create and edit promotion rules', 'sales')
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  r_org RECORD;
BEGIN
  FOR r_org IN SELECT id FROM public.organizations LOOP
    INSERT INTO public.role_permissions (org_id, role, permission_key)
    SELECT r_org.id, 'owner', key FROM public.permissions WHERE key = 'manage_promotions'
    ON CONFLICT DO NOTHING;

    INSERT INTO public.role_permissions (org_id, role, permission_key) VALUES
      (r_org.id, 'manager', 'manage_promotions')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- evaluate_cart_promotions — mirrors TS evaluatePromotions
-- Input lines: [{line_key, product_id, category_id, quantity, unit_price}]
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.evaluate_cart_promotions(
  p_org_id UUID,
  p_store_id UUID,
  p_sales_mode TEXT,
  p_lines JSONB,
  p_coupon_code TEXT DEFAULT NULL,
  p_now TIMESTAMPTZ DEFAULT now()
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_coupon TEXT := NULLIF(upper(trim(COALESCE(p_coupon_code, ''))), '');
  v_sale_mode TEXT := COALESCE(NULLIF(p_sales_mode, ''), 'retail');
  v_rules JSONB := '[]'::jsonb;
  v_rule JSONB;
  v_line JSONB;
  v_out_lines JSONB := '[]'::jsonb;
  v_apps JSONB := '[]'::jsonb;
  v_subtotal NUMERIC := 0;
  v_cart_discount NUMERIC := 0;
  v_cart_rule_id UUID := NULL;
  v_cart_rule_name TEXT := NULL;
  v_list_unit NUMERIC;
  v_qty NUMERIC;
  v_gross NUMERIC;
  v_best_disc NUMERIC;
  v_best_rule_id UUID;
  v_best_rule_name TEXT;
  v_best_priority INT;
  v_disc NUMERIC;
  v_line_total NUMERIC;
  v_unit_price NUMERIC;
  v_sched_price NUMERIC;
  v_cfg JSONB;
  v_buy NUMERIC;
  v_get NUMERIC;
  v_get_pct NUMERIC;
  v_bundle NUMERIC;
  v_free NUMERIC;
  v_min_qty NUMERIC;
  v_pct NUMERIC;
  v_amt NUMERIC;
  v_auto_cart_id UUID;
  v_auto_cart_amt NUMERIC := 0;
  v_auto_cart_name TEXT;
  v_auto_stack BOOLEAN := false;
  v_coup_cart_id UUID;
  v_coup_cart_amt NUMERIC := 0;
  v_coup_cart_name TEXT;
  v_coup_stack BOOLEAN := false;
  v_has_coupon BOOLEAN;
  v_scope_ok BOOLEAN;
  v_modes TEXT[];
  v_store_ids UUID[];
BEGIN
  IF COALESCE(jsonb_array_length(p_lines), 0) = 0 THEN
    RETURN jsonb_build_object(
      'lines', '[]'::jsonb,
      'subtotal', 0,
      'cart_discount', 0,
      'cart_rule_id', NULL,
      'applications', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.priority DESC, r.id), '[]'::jsonb)
  INTO v_rules
  FROM public.promotion_rules r
  WHERE r.org_id = p_org_id
    AND r.is_active = true
    AND (r.starts_at IS NULL OR r.starts_at <= p_now)
    AND (r.ends_at IS NULL OR r.ends_at >= p_now)
    AND (r.usage_limit_total IS NULL OR r.usage_count < r.usage_limit_total)
    AND (
      r.store_ids IS NULL
      OR cardinality(r.store_ids) = 0
      OR (p_store_id IS NOT NULL AND p_store_id = ANY (r.store_ids))
    )
    AND (v_sale_mode = ANY (r.sale_modes));

  -- Pass 1: scheduled + item discounts
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_qty := COALESCE((v_line->>'quantity')::numeric, 0);
    v_list_unit := COALESCE((v_line->>'unit_price')::numeric, 0);
    v_best_disc := 0;
    v_best_rule_id := NULL;
    v_best_rule_name := NULL;
    v_best_priority := -2147483648;

    -- Scheduled sale (first / highest priority match)
    FOR v_rule IN SELECT * FROM jsonb_array_elements(v_rules)
    LOOP
      IF v_rule->>'rule_type' IS DISTINCT FROM 'scheduled_sale_price' THEN
        CONTINUE;
      END IF;
      v_has_coupon := NULLIF(upper(trim(COALESCE(v_rule->>'coupon_code', ''))), '') IS NOT NULL;
      IF v_has_coupon AND upper(trim(COALESCE(v_rule->>'coupon_code', ''))) IS DISTINCT FROM v_coupon THEN
        CONTINUE;
      END IF;
      IF v_has_coupon = false AND v_coupon IS NOT NULL AND NULLIF(upper(trim(COALESCE(v_rule->>'coupon_code', ''))), '') IS NOT NULL THEN
        CONTINUE;
      END IF;
      -- auto rules (no coupon) always; coupon rules only when code matches (above)
      IF v_has_coupon = false OR upper(trim(COALESCE(v_rule->>'coupon_code', ''))) = v_coupon THEN
        NULL;
      END IF;

      v_scope_ok := false;
      IF COALESCE(v_rule->>'scope_type', 'all') = 'all' THEN
        v_scope_ok := true;
      ELSIF v_rule->>'scope_type' = 'product' THEN
        v_scope_ok := (v_line->>'product_id')::uuid = ANY (
          COALESCE((SELECT array_agg(value::uuid) FROM jsonb_array_elements_text(COALESCE(v_rule->'scope_ids', '[]'::jsonb))), '{}'::uuid[])
        );
      ELSIF v_rule->>'scope_type' = 'category' THEN
        v_scope_ok := NULLIF(v_line->>'category_id', '') IS NOT NULL
          AND (v_line->>'category_id')::uuid = ANY (
            COALESCE((SELECT array_agg(value::uuid) FROM jsonb_array_elements_text(COALESCE(v_rule->'scope_ids', '[]'::jsonb))), '{}'::uuid[])
          );
      END IF;
      IF NOT v_scope_ok THEN CONTINUE; END IF;

      v_sched_price := NULLIF(v_rule->'config'->>'sale_price', '')::numeric;
      IF v_sched_price IS NULL OR v_sched_price < 0 THEN CONTINUE; END IF;
      v_list_unit := v_sched_price;
      EXIT;
    END LOOP;

    -- Best item discount
    FOR v_rule IN SELECT * FROM jsonb_array_elements(v_rules)
    LOOP
      IF v_rule->>'rule_type' NOT IN ('percent_off_item', 'fixed_off_item', 'qty_threshold', 'bogo') THEN
        CONTINUE;
      END IF;
      v_has_coupon := NULLIF(upper(trim(COALESCE(v_rule->>'coupon_code', ''))), '') IS NOT NULL;
      IF v_has_coupon THEN
        IF v_coupon IS NULL OR upper(trim(COALESCE(v_rule->>'coupon_code', ''))) IS DISTINCT FROM v_coupon THEN
          CONTINUE;
        END IF;
      END IF;

      v_scope_ok := false;
      IF COALESCE(v_rule->>'scope_type', 'all') = 'all' THEN
        v_scope_ok := true;
      ELSIF v_rule->>'scope_type' = 'product' THEN
        SELECT COALESCE(array_agg(value::uuid), '{}'::uuid[]) INTO v_store_ids
        FROM jsonb_array_elements_text(COALESCE(v_rule->'scope_ids', '[]'::jsonb));
        v_scope_ok := (v_line->>'product_id')::uuid = ANY (v_store_ids);
      ELSIF v_rule->>'scope_type' = 'category' THEN
        SELECT COALESCE(array_agg(value::uuid), '{}'::uuid[]) INTO v_store_ids
        FROM jsonb_array_elements_text(COALESCE(v_rule->'scope_ids', '[]'::jsonb));
        v_scope_ok := NULLIF(v_line->>'category_id', '') IS NOT NULL
          AND (v_line->>'category_id')::uuid = ANY (v_store_ids);
      END IF;
      IF NOT v_scope_ok THEN CONTINUE; END IF;

      v_cfg := COALESCE(v_rule->'config', '{}'::jsonb);
      v_gross := round(v_list_unit * v_qty, 2);
      v_disc := 0;

      IF v_rule->>'rule_type' = 'percent_off_item' THEN
        v_pct := LEAST(100, GREATEST(0, COALESCE((v_cfg->>'percent')::numeric, 0)));
        v_disc := round(v_gross * (v_pct / 100.0), 2);
      ELSIF v_rule->>'rule_type' = 'fixed_off_item' THEN
        v_amt := GREATEST(0, COALESCE((v_cfg->>'amount')::numeric, 0));
        v_disc := round(LEAST(v_gross, v_amt * v_qty), 2);
      ELSIF v_rule->>'rule_type' = 'qty_threshold' THEN
        v_min_qty := GREATEST(0, COALESCE((v_cfg->>'min_qty')::numeric, 0));
        IF v_qty >= v_min_qty THEN
          IF v_cfg ? 'percent' THEN
            v_pct := LEAST(100, GREATEST(0, COALESCE((v_cfg->>'percent')::numeric, 0)));
            v_disc := round(v_gross * (v_pct / 100.0), 2);
          ELSE
            v_amt := GREATEST(0, COALESCE((v_cfg->>'amount')::numeric, 0));
            v_disc := round(LEAST(v_gross, v_amt), 2);
          END IF;
        END IF;
      ELSIF v_rule->>'rule_type' = 'bogo' THEN
        v_buy := GREATEST(1, COALESCE((v_cfg->>'buy_qty')::numeric, 1));
        v_get := GREATEST(1, COALESCE((v_cfg->>'get_qty')::numeric, 1));
        v_get_pct := LEAST(100, GREATEST(0, COALESCE((v_cfg->>'get_percent')::numeric, 100)));
        v_bundle := v_buy + v_get;
        IF v_qty >= v_bundle AND v_bundle > 0 THEN
          v_free := floor(v_qty / v_bundle) * v_get;
          v_disc := round(v_free * v_list_unit * (v_get_pct / 100.0), 2);
        END IF;
      END IF;

      IF v_disc > v_best_disc
         OR (v_disc = v_best_disc AND COALESCE((v_rule->>'priority')::int, 0) > v_best_priority) THEN
        v_best_disc := v_disc;
        v_best_rule_id := (v_rule->>'id')::uuid;
        v_best_rule_name := v_rule->>'name';
        v_best_priority := COALESCE((v_rule->>'priority')::int, 0);
      END IF;
    END LOOP;

    v_gross := round(v_list_unit * v_qty, 2);
    v_best_disc := round(LEAST(v_gross, v_best_disc), 2);
    v_line_total := round(GREATEST(0, v_gross - v_best_disc), 2);
    v_unit_price := CASE WHEN v_qty > 0 THEN round(v_line_total / v_qty, 2) ELSE 0 END;
    v_subtotal := v_subtotal + v_line_total;

    IF v_best_rule_id IS NOT NULL AND v_best_disc > 0 THEN
      v_apps := v_apps || jsonb_build_array(jsonb_build_object(
        'promotion_rule_id', v_best_rule_id,
        'amount', v_best_disc,
        'level', 'item',
        'line_key', v_line->>'line_key',
        'rule_name', v_best_rule_name
      ));
    END IF;

    v_out_lines := v_out_lines || jsonb_build_array(jsonb_build_object(
      'line_key', v_line->>'line_key',
      'list_unit_price', v_list_unit,
      'unit_price', v_unit_price,
      'quantity', v_qty,
      'discount_amount', v_best_disc,
      'promotion_rule_id', v_best_rule_id,
      'line_total', v_line_total
    ));
  END LOOP;

  v_subtotal := round(v_subtotal, 2);

  -- Cart rules
  FOR v_rule IN SELECT * FROM jsonb_array_elements(v_rules)
  LOOP
    IF v_rule->>'rule_type' NOT IN ('cart_percent', 'cart_fixed') THEN CONTINUE; END IF;
    v_has_coupon := NULLIF(upper(trim(COALESCE(v_rule->>'coupon_code', ''))), '') IS NOT NULL;
    IF v_has_coupon THEN
      IF v_coupon IS NULL OR upper(trim(COALESCE(v_rule->>'coupon_code', ''))) IS DISTINCT FROM v_coupon THEN
        CONTINUE;
      END IF;
    END IF;

    IF v_subtotal < COALESCE((v_rule->>'min_subtotal')::numeric, 0) THEN CONTINUE; END IF;
    v_cfg := COALESCE(v_rule->'config', '{}'::jsonb);
    v_disc := 0;
    IF v_rule->>'rule_type' = 'cart_percent' THEN
      v_pct := LEAST(100, GREATEST(0, COALESCE((v_cfg->>'percent')::numeric, 0)));
      v_disc := round(v_subtotal * (v_pct / 100.0), 2);
    ELSE
      v_amt := GREATEST(0, COALESCE((v_cfg->>'amount')::numeric, 0));
      v_disc := round(LEAST(v_subtotal, v_amt), 2);
    END IF;
    IF v_disc <= 0 THEN CONTINUE; END IF;

    IF v_has_coupon THEN
      IF v_disc > v_coup_cart_amt THEN
        v_coup_cart_amt := v_disc;
        v_coup_cart_id := (v_rule->>'id')::uuid;
        v_coup_cart_name := v_rule->>'name';
        v_coup_stack := COALESCE((v_rule->>'stackable_with_cart')::boolean, false);
      END IF;
    ELSE
      IF v_disc > v_auto_cart_amt THEN
        v_auto_cart_amt := v_disc;
        v_auto_cart_id := (v_rule->>'id')::uuid;
        v_auto_cart_name := v_rule->>'name';
        v_auto_stack := COALESCE((v_rule->>'stackable_with_cart')::boolean, false);
      END IF;
    END IF;
  END LOOP;

  IF v_coup_cart_id IS NOT NULL AND v_auto_cart_id IS NOT NULL THEN
    IF v_auto_stack OR v_coup_stack THEN
      IF v_coup_cart_amt >= v_auto_cart_amt THEN
        v_cart_discount := v_coup_cart_amt;
        v_cart_rule_id := v_coup_cart_id;
        v_cart_rule_name := v_coup_cart_name;
      ELSE
        v_cart_discount := v_auto_cart_amt;
        v_cart_rule_id := v_auto_cart_id;
        v_cart_rule_name := v_auto_cart_name;
      END IF;
    ELSE
      v_cart_discount := v_coup_cart_amt;
      v_cart_rule_id := v_coup_cart_id;
      v_cart_rule_name := v_coup_cart_name;
    END IF;
  ELSIF v_coup_cart_id IS NOT NULL THEN
    v_cart_discount := v_coup_cart_amt;
    v_cart_rule_id := v_coup_cart_id;
    v_cart_rule_name := v_coup_cart_name;
  ELSE
    v_cart_discount := v_auto_cart_amt;
    v_cart_rule_id := v_auto_cart_id;
    v_cart_rule_name := v_auto_cart_name;
  END IF;

  v_cart_discount := round(LEAST(v_subtotal, COALESCE(v_cart_discount, 0)), 2);

  IF v_cart_rule_id IS NOT NULL AND v_cart_discount > 0 THEN
    v_apps := v_apps || jsonb_build_array(jsonb_build_object(
      'promotion_rule_id', v_cart_rule_id,
      'amount', v_cart_discount,
      'level', 'cart',
      'line_key', NULL,
      'rule_name', v_cart_rule_name
    ));
  END IF;

  RETURN jsonb_build_object(
    'lines', v_out_lines,
    'subtotal', v_subtotal,
    'cart_discount', v_cart_discount,
    'cart_rule_id', v_cart_rule_id,
    'applications', v_apps
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_cart_promotions(
  UUID, UUID, TEXT, JSONB, TEXT, TIMESTAMPTZ
) TO authenticated, service_role;
