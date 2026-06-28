-- Keep order discounts inside the same bounds enforced by the POS service.
-- NOT VALID avoids blocking existing historical rows while still enforcing new writes.

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_discount_bounds;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_discount_bounds
  CHECK (
    discount >= 0
    AND discount <= subtotal
  ) NOT VALID;
