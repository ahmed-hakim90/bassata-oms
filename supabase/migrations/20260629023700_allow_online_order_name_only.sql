ALTER TABLE public.online_orders
  ALTER COLUMN customer_phone DROP NOT NULL;

ALTER TABLE public.online_orders
  DROP CONSTRAINT IF EXISTS online_orders_customer_phone_not_blank;
