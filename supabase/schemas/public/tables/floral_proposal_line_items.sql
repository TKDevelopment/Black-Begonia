create table public.floral_proposal_line_items (
  floral_proposal_line_item_id uuid not null default gen_random_uuid (),
  floral_proposal_id uuid not null,
  display_order integer not null default 0,
  line_item_type public.floral_proposal_line_item_type not null default 'product'::floral_proposal_line_item_type,
  item_name text not null,
  quantity integer not null default 1,
  unit_price numeric(12, 2) not null default 0,
  subtotal numeric(12, 2) not null default 0,
  notes text null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  description text null,
  image_storage_path text null,
  image_alt_text text null,
  image_caption text null,
  constraint floral_proposal_line_items_pkey primary key (floral_proposal_line_item_id),
  constraint floral_proposal_line_items_floral_proposal_id_fkey foreign KEY (floral_proposal_id) references floral_proposals (floral_proposal_id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_floral_proposal_line_items_proposal_id on public.floral_proposal_line_items using btree (floral_proposal_id, display_order) TABLESPACE pg_default;

create trigger trg_floral_proposal_line_items_set_updated_at BEFORE
update on floral_proposal_line_items for EACH row
execute FUNCTION set_updated_at ();