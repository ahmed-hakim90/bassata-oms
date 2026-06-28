ALTER TABLE public.loyalty_rules
  ADD COLUMN IF NOT EXISTS minimum_redeem_points INT NOT NULL DEFAULT 0;

ALTER TABLE public.loyalty_rules
  DROP CONSTRAINT IF EXISTS loyalty_rules_minimum_redeem_points_non_negative;

ALTER TABLE public.loyalty_rules
  ADD CONSTRAINT loyalty_rules_minimum_redeem_points_non_negative
  CHECK (minimum_redeem_points >= 0);
