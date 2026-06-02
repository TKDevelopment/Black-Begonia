create table public.lead_inspiration_urls (
  lead_inspiration_url_id uuid not null default gen_random_uuid (),
  lead_id uuid not null,
  url text not null,
  created_at timestamp with time zone not null default now(),
  constraint lead_inspiration_urls_pkey primary key (lead_inspiration_url_id),
  constraint lead_inspiration_urls_lead_id_fkey foreign KEY (lead_id) references leads (lead_id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_lead_inspiration_urls_lead_id on public.lead_inspiration_urls using btree (lead_id) TABLESPACE pg_default;