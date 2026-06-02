create table public.profiles (
  id uuid not null,
  email text not null,
  first_name text null,
  last_name text null,
  display_name text GENERATED ALWAYS as (
    TRIM(
      both
      from
        (
          (COALESCE(first_name, ''::text) || ' '::text) || COALESCE(last_name, ''::text)
        )
    )
  ) STORED null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_email_key unique (email),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger trg_profiles_set_updated_at BEFORE
update on profiles for EACH row
execute FUNCTION set_updated_at ();