create table public.floral_proposal_shopping_lists (
  floral_proposal_shopping_list_id uuid not null default gen_random_uuid (),
  floral_proposal_id uuid not null,
  status public.floral_proposal_shopping_list_status not null default 'generated'::floral_proposal_shopping_list_status,
  generated_at timestamp with time zone not null default now(),
  exported_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint floral_proposal_shopping_lists_pkey primary key (floral_proposal_shopping_list_id),
  constraint floral_proposal_shopping_lists_floral_proposal_id_key unique (floral_proposal_id),
  constraint floral_proposal_shopping_lists_floral_proposal_id_fkey foreign KEY (floral_proposal_id) references floral_proposals (floral_proposal_id) on delete CASCADE
) TABLESPACE pg_default;

create trigger trg_floral_proposal_shopping_lists_set_updated_at BEFORE
update on floral_proposal_shopping_lists for EACH row
execute FUNCTION set_updated_at ();