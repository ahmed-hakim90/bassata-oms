DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shelf_life_unit_type') THEN
    CREATE TYPE shelf_life_unit_type AS ENUM ('days', 'months', 'years');
  END IF;
END $$;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS shelf_life_value INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shelf_life_unit shelf_life_unit_type NOT NULL DEFAULT 'days';

UPDATE products
SET
  shelf_life_value = CASE
    WHEN COALESCE(shelf_life_years, 0) > 0 THEN shelf_life_years
    WHEN COALESCE(shelf_life_months, 0) > 0 THEN shelf_life_months
    ELSE COALESCE(shelf_life_days, 0)
  END,
  shelf_life_unit = CASE
    WHEN COALESCE(shelf_life_years, 0) > 0 THEN 'years'::shelf_life_unit_type
    WHEN COALESCE(shelf_life_months, 0) > 0 THEN 'months'::shelf_life_unit_type
    ELSE 'days'::shelf_life_unit_type
  END;

CREATE OR REPLACE FUNCTION calculate_product_expiry_date(
  p_production_date DATE,
  p_shelf_life_value INT,
  p_shelf_life_unit shelf_life_unit_type
) RETURNS DATE AS $$
BEGIN
  IF p_production_date IS NULL THEN
    RETURN NULL;
  END IF;

  IF COALESCE(p_shelf_life_value, 0) <= 0 THEN
    RETURN p_production_date;
  END IF;

  RETURN (
    p_production_date
    + CASE COALESCE(p_shelf_life_unit, 'days'::shelf_life_unit_type)
      WHEN 'years'::shelf_life_unit_type THEN make_interval(years => p_shelf_life_value)
      WHEN 'months'::shelf_life_unit_type THEN make_interval(months => p_shelf_life_value)
      ELSE make_interval(days => p_shelf_life_value)
    END
  )::date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE products
  DROP COLUMN IF EXISTS shelf_life_days,
  DROP COLUMN IF EXISTS shelf_life_months,
  DROP COLUMN IF EXISTS shelf_life_years;
