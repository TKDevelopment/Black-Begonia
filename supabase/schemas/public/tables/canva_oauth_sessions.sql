create table public.canva_oauth_sessions (
  canva_oauth_session_id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  state text not null,
  code_verifier text not null,
  redirect_uri text not null,
  app_origin text not null,
  status text not null default 'pending'::text,
  error text null,
  created_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone null,
  constraint canva_oauth_sessions_pkey primary key (canva_oauth_session_id),
  constraint canva_oauth_sessions_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists canva_oauth_sessions_state_key on public.canva_oauth_sessions using btree (state) TABLESPACE pg_default;

create index IF not exists canva_oauth_sessions_user_id_idx on public.canva_oauth_sessions using btree (user_id, created_at desc) TABLESPACE pg_default;