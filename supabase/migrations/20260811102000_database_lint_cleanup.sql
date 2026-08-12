-- Resolve plpgsql_check warnings without duplicating the large business functions.
-- Each replacement targets the exact definition installed by the preceding migrations.

ALTER FUNCTION public.slugify_store_name(text, text) VOLATILE;

DO $migration$
DECLARE
  v_definition text;
  v_updated text;
BEGIN
  SELECT pg_get_functiondef(
    'public.seed_org_defaults(uuid,uuid)'::regprocedure
  ) INTO v_definition;
  v_updated := replace(
    v_definition,
    E'BEGIN\n',
    E'BEGIN\n  -- Reserved for future store-specific defaults; reading it keeps the API stable.\n  PERFORM p_store_id;\n'
  );
  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'Could not patch seed_org_defaults';
  END IF;
  EXECUTE v_updated;

  SELECT pg_get_functiondef(
    'public.evaluate_cart_promotions(uuid,uuid,text,jsonb,text,timestamptz)'::regprocedure
  ) INTO v_definition;
  v_updated := replace(v_definition, E'  v_modes TEXT[];\n', '');
  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'Could not patch evaluate_cart_promotions';
  END IF;
  EXECUTE v_updated;

  SELECT pg_get_functiondef(
    'public.complete_checkout_core(uuid,uuid,uuid,uuid,payment_method,numeric,jsonb,uuid,sales_mode,text)'::regprocedure
  ) INTO v_definition;
  v_updated := replace(
    v_definition,
    E'  v_activity business_activity_type := ''retail'';',
    E'  v_activity business_activity_type := ''retail''::business_activity_type;'
  );
  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'Could not patch complete_checkout_core';
  END IF;
  EXECUTE v_updated;

  SELECT pg_get_functiondef(
    'public.deliver_sales_invoice(uuid,payment_method,jsonb)'::regprocedure
  ) INTO v_definition;
  v_updated := replace(v_definition, E'  v_product_type product_type;\n', '');
  v_updated := replace(
    v_updated,
    '    SELECT p.track_inventory, p.name, p.product_type',
    '    SELECT p.track_inventory, p.name'
  );
  v_updated := replace(
    v_updated,
    '    INTO v_track, v_product_name, v_product_type',
    '    INTO v_track, v_product_name'
  );
  IF v_updated = v_definition THEN
    RAISE EXCEPTION 'Could not patch deliver_sales_invoice';
  END IF;
  EXECUTE v_updated;
END;
$migration$;
