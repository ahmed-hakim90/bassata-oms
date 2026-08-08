-- Extend business_activity_type for bakery + pharmacy verticals.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'business_activity_type' AND e.enumlabel = 'bakery'
  ) THEN
    ALTER TYPE business_activity_type ADD VALUE 'bakery';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'business_activity_type' AND e.enumlabel = 'pharmacy'
  ) THEN
    ALTER TYPE business_activity_type ADD VALUE 'pharmacy';
  END IF;
END $$;
