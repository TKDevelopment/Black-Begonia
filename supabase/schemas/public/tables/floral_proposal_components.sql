create table public.floral_proposal_components (
  floral_proposal_component_id uuid not null default gen_random_uuid (),
  floral_proposal_line_item_id uuid not null,
  display_order integer not null default 0,
  catalog_item_id uuid null,
  catalog_item_name text not null,
  quantity_per_unit numeric(12, 2) not null default 0,
  extended_quantity numeric(12, 2) not null default 0,
  base_unit_cost numeric(12, 2) not null default 0,
  applied_markup_percent numeric(8, 2) not null default 0,
  sell_unit_price numeric(12, 2) not null default 0,
  subtotal numeric(12, 2) not null default 0,
  reserve_percent numeric(8, 2) not null default 0,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint floral_proposal_components_pkey primary key (floral_proposal_component_id),
  constraint floral_proposal_components_catalog_item_id_fkey foreign KEY (catalog_item_id) references catalog_items (item_id) on delete set null,
  constraint floral_proposal_components_floral_proposal_line_item_id_fkey foreign KEY (floral_proposal_line_item_id) references floral_proposal_line_items (floral_proposal_line_item_id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_floral_proposal_components_line_item_id on public.floral_proposal_components using btree (floral_proposal_line_item_id, display_order) TABLESPACE pg_default;

create trigger trg_floral_proposal_components_set_updated_at BEFORE
update on floral_proposal_components for EACH row
execute FUNCTION set_updated_at ();