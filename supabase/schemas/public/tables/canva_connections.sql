create table public.canva_connections (
  canva_connection_id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  canva_user_id text null,
  canva_team_id text null,
  display_name text null,
  scopes text[] not null default '{}'::text[],
  access_token text not null,
  refresh_token text not null,
  token_type text not null default 'Bearer'::text,
  expires_at timestamp with time zone not null,
  connected_at timestamp with time zone not null default now(),
  refreshed_at timestamp with time zone not null default now(),
  last_used_at timestamp with time zone null,
  metadata jsonb not null default '{}'::jsonb,
  constraint canva_connections_pkey primary key (canva_connection_id),
  constraint canva_connections_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists canva_connections_user_id_key on public.canva_connections using btree (user_id) TABLESPACE pg_default;