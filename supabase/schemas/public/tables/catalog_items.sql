create table public.catalog_items (
  item_id uuid not null default gen_random_uuid (),
  name text not null,
  item_type public.catalog_item_type not null,
  unit_type public.catalog_unit_type not null,
  color text null,
  variety text null,
  sku text null,
  base_unit_cost numeric(10, 2) not null default 0,
  default_waste_percent numeric(5, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  pack_quantity smallint null,
  constraint catalog_items_pkey primary key (item_id)
) TABLESPACE pg_default;

create index IF not exists idx_catalog_items_name on public.catalog_items using btree (name) TABLESPACE pg_default;

create index IF not exists idx_catalog_items_type on public.catalog_items using btree (item_type) TABLESPACE pg_default;

create index IF not exists idx_catalog_items_active on public.catalog_items using btree (is_active) TABLESPACE pg_default;

create trigger trg_catalog_items_set_updated_at BEFORE
update on catalog_items for EACH row
execute FUNCTION set_updated_at ();