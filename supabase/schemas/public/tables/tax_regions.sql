create table public.tax_regions (
  tax_region_id uuid not null default gen_random_uuid (),
  name text not null,
  authority_name text null,
  tax_rate numeric(6, 4) not null,
  applies_to_products boolean not null default true,
  applies_to_services boolean not null default true,
  applies_to_delivery boolean not null default true,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint tax_regions_pkey primary key (tax_region_id),
  constraint tax_regions_tax_rate_nonnegative check ((tax_rate >= (0)::numeric))
) TABLESPACE pg_default;

create index IF not exists idx_tax_regions_name on public.tax_regions using btree (name) TABLESPACE pg_default;

create index IF not exists idx_tax_regions_active on public.tax_regions using btree (is_active) TABLESPACE pg_default;

create trigger trg_tax_regions_set_updated_at BEFORE
update on tax_regions for EACH row
execute FUNCTION set_updated_at ();