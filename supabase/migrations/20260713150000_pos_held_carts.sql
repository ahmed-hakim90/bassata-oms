-- S10: Persist POS held carts server-side (store + device scoped).
-- Cart payload is UX state only — money still settles via checkout RPCs (ADR-007).

CREATE TABLE IF NOT EXISTS public.pos_held_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.users(id),
  name TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pos_held_carts_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT pos_held_carts_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_pos_held_carts_store_device_created
  ON public.pos_held_carts (store_id, device_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_held_carts_org
  ON public.pos_held_carts (org_id);

-- Device must belong to the same store as the hold.
CREATE OR REPLACE FUNCTION public.check_pos_held_cart_device_store()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.devices d
    WHERE d.id = NEW.device_id
      AND d.store_id = NEW.store_id
  ) THEN
    RAISE EXCEPTION 'Held cart device does not belong to store';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = NEW.store_id
      AND s.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'Held cart store does not belong to org';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pos_held_cart_device_store ON public.pos_held_carts;
CREATE TRIGGER trg_pos_held_cart_device_store
  BEFORE INSERT OR UPDATE OF device_id, store_id, org_id
  ON public.pos_held_carts
  FOR EACH ROW
  EXECUTE FUNCTION public.check_pos_held_cart_device_store();

ALTER TABLE public.pos_held_carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pos_held_carts_select ON public.pos_held_carts;
DROP POLICY IF EXISTS pos_held_carts_insert ON public.pos_held_carts;
DROP POLICY IF EXISTS pos_held_carts_update ON public.pos_held_carts;
DROP POLICY IF EXISTS pos_held_carts_delete ON public.pos_held_carts;

-- Org + store access; device scoping enforced in app via requirePosAccess.
CREATE POLICY pos_held_carts_select ON public.pos_held_carts
  FOR SELECT
  USING (org_id = auth_org_id() AND has_store_access(store_id));

CREATE POLICY pos_held_carts_insert ON public.pos_held_carts
  FOR INSERT
  WITH CHECK (
    org_id = auth_org_id()
    AND has_store_access(store_id)
    AND created_by = auth_app_user_id()
  );

CREATE POLICY pos_held_carts_update ON public.pos_held_carts
  FOR UPDATE
  USING (org_id = auth_org_id() AND has_store_access(store_id))
  WITH CHECK (org_id = auth_org_id() AND has_store_access(store_id));

CREATE POLICY pos_held_carts_delete ON public.pos_held_carts
  FOR DELETE
  USING (org_id = auth_org_id() AND has_store_access(store_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_held_carts TO authenticated;
