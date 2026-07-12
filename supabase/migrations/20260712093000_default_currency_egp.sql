-- Lock SweetFlow to Egyptian Pound (EGP) as the system currency.

ALTER TABLE organizations
  ALTER COLUMN currency SET DEFAULT 'EGP';

UPDATE organizations
SET currency = 'EGP'
WHERE currency IS DISTINCT FROM 'EGP';

-- Keep onboarding RPC fallbacks aligned with EGP / Cairo.
DO $$
DECLARE
  def text;
BEGIN
  SELECT replace(
    replace(pg_get_functiondef(p.oid), '''USD''', '''EGP'''),
    '''America/New_York''',
    '''Africa/Cairo'''
  )
  INTO def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'initialize_organization'
  LIMIT 1;

  IF def IS NULL THEN
    RAISE EXCEPTION 'initialize_organization not found';
  END IF;

  EXECUTE def;
END $$;
