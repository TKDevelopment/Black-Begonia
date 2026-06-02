create table public.portfolio_galleries (
  gallery_id uuid not null default gen_random_uuid (),
  slug text not null,
  couple_names text not null,
  venue text not null,
  event_date date null,
  cover_image_url text not null,
  is_featured boolean not null default false,
  is_active boolean not null default false,
  created_at timestamp with time zone not null default now(),
  hero_image_url text not null,
  description text null,
  view_order smallint null,
  constraint portfolio_galleries_pkey primary key (gallery_id)
) TABLESPACE pg_default;