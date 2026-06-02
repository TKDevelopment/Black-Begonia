create table public.floral_proposal_shopping_list_items (
  floral_proposal_shopping_list_item_id uuid not null default gen_random_uuid (),
  floral_proposal_shopping_list_id uuid not null,
  catalog_item_id uuid null,
  item_name text not null,
  item_type public.catalog_item_type not null,
  unit_type public.catalog_unit_type not null,
  required_units numeric(12, 2) not null default 0,
  reserve_percent numeric(8, 2) not null default 0,
  reserve_units numeric(12, 2) not null default 0,
  total_units_to_buy numeric(12, 2) not null default 0,
  units_per_pack numeric(12, 2) null,
  required_pack_count integer null,
  estimated_pack_cost numeric(12, 2) null,
  total_estimated_cost numeric(12, 2) null,
  notes text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint floral_proposal_shopping_list_items_pkey primary key (floral_proposal_shopping_list_item_id),
  constraint floral_proposal_shopping_list_floral_proposal_shopping_lis_fkey foreign KEY (floral_proposal_shopping_list_id) references floral_proposal_shopping_lists (floral_proposal_shopping_list_id) on delete CASCADE,
  constraint floral_proposal_shopping_list_items_catalog_item_id_fkey foreign KEY (catalog_item_id) references catalog_items (item_id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_floral_proposal_shopping_list_items_list_id on public.floral_proposal_shopping_list_items using btree (floral_proposal_shopping_list_id) TABLESPACE pg_default;

create trigger trg_floral_proposal_shopping_list_items_set_updated_at BEFORE
update on floral_proposal_shopping_list_items for EACH row
execute FUNCTION set_updated_at ();