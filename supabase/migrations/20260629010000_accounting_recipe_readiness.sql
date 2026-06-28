-- Production readiness for variant-level costing.
-- Recipes stay optional; these checks make missing costing visible without rewriting history.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'variant_kind') then
    create type public.variant_kind as enum ('standard', 'weight_portion');
  end if;
  if not exists (select 1 from pg_type where typname = 'variant_price_mode') then
    create type public.variant_price_mode as enum ('calculate_from_unit_price', 'fixed_price');
  end if;
end $$;

alter table if exists public.product_recipes
  add column if not exists variant_id uuid references public.product_variants(id) on delete cascade;

alter table if exists public.product_variants
  add column if not exists price numeric(12,2),
  add column if not exists image_url text,
  add column if not exists variant_kind public.variant_kind not null default 'standard',
  add column if not exists quantity_value numeric(12,3),
  add column if not exists quantity_unit public.measurement_unit,
  add column if not exists price_mode public.variant_price_mode,
  add column if not exists fixed_price numeric(12,2);

alter table if exists public.order_items
  add column if not exists unit_cost numeric(12,4) not null default 0,
  add column if not exists line_cost numeric(12,4) not null default 0;

create index if not exists idx_product_recipes_product_variant_lookup
  on public.product_recipes(product_id, variant_id);

create unique index if not exists product_recipes_base_unique
  on public.product_recipes(product_id)
  where variant_id is null;

create unique index if not exists product_recipes_variant_unique
  on public.product_recipes(product_id, variant_id)
  where variant_id is not null;

create index if not exists idx_product_variants_product_sku
  on public.product_variants(product_id, lower(sku))
  where sku is not null and sku <> '';

create index if not exists idx_order_item_deductions_order_item
  on public.order_item_deductions(order_item_id);

create or replace function public.accounting_missing_recipe_variants()
returns table (
  product_id uuid,
  product_name text,
  product_sku text,
  variant_id uuid,
  variant_name text,
  variant_sku text,
  issue text
)
language sql
security definer
set search_path = public
as $$
  select
    p.id as product_id,
    p.name as product_name,
    p.sku as product_sku,
    v.id as variant_id,
    v.name as variant_name,
    v.sku as variant_sku,
    'active_variant_without_recipe'::text as issue
  from public.products p
  join public.product_variants v on v.product_id = p.id
  left join public.product_recipes specific_recipe
    on specific_recipe.product_id = p.id
   and specific_recipe.variant_id = v.id
  left join public.product_recipes base_recipe
    on base_recipe.product_id = p.id
   and base_recipe.variant_id is null
  where p.org_id = (select org_id from public.users where auth_user_id = auth.uid() limit 1)
    and p.is_active = true
    and v.is_active = true
    and (
      p.product_type = 'finished'
      or coalesce(p.inventory_product_type, 'finished_product') = 'finished_product'
    )
    and specific_recipe.id is null
    and base_recipe.id is null
  order by p.name, v.name;
$$;

create or replace function public.accounting_zero_cost_order_items(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  order_id uuid,
  order_number text,
  order_created_at timestamptz,
  order_item_id uuid,
  product_id uuid,
  product_name text,
  product_sku text,
  variant_id uuid,
  variant_name text,
  quantity numeric,
  line_total numeric,
  line_cost numeric,
  issue text
)
language sql
security definer
set search_path = public
as $$
  select
    o.id as order_id,
    o.order_number,
    o.created_at as order_created_at,
    oi.id as order_item_id,
    p.id as product_id,
    p.name as product_name,
    p.sku as product_sku,
    oi.variant_id,
    v.name as variant_name,
    oi.quantity,
    oi.line_total,
    oi.line_cost,
    case
      when pr.id is null then 'sold_without_recipe'
      else 'sold_with_zero_recorded_cost'
    end as issue
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.stores s on s.id = o.store_id
  join public.products p on p.id = oi.product_id
  left join public.product_variants v on v.id = oi.variant_id
  left join public.product_recipes pr
    on pr.product_id = oi.product_id
   and (pr.variant_id = oi.variant_id or (pr.variant_id is null and oi.variant_id is null))
  where s.org_id = (select org_id from public.users where auth_user_id = auth.uid() limit 1)
    and o.status in ('completed', 'paid')
    and (
      p.product_type = 'finished'
      or coalesce(p.inventory_product_type, 'finished_product') = 'finished_product'
    )
    and coalesce(oi.line_cost, 0) = 0
    and coalesce(oi.line_total, 0) > 0
    and (p_from is null or o.created_at >= p_from)
    and (p_to is null or o.created_at < p_to)
  order by o.created_at desc;
$$;

grant execute on function public.accounting_missing_recipe_variants() to authenticated;
grant execute on function public.accounting_zero_cost_order_items(timestamptz, timestamptz) to authenticated;

comment on function public.accounting_missing_recipe_variants()
  is 'Lists active finished-product variants that can sell but currently have no recipe costing.';

comment on function public.accounting_zero_cost_order_items(timestamptz, timestamptz)
  is 'Lists completed order items recorded with zero COGS so finance can review missing costing before production reporting.';
