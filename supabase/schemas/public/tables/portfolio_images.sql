create table public.portfolio_images (
  image_id uuid not null default gen_random_uuid (),
  gallery_id uuid not null,
  image_url text not null,
  alt_text text null,
  view_order smallint null,
  is_visible boolean not null,
  created_at timestamp with time zone not null default now(),
  thumb_url text null,
  full_url text null,
  constraint portfolio_images_pkey primary key (image_id),
  constraint portfolio_images_gallery_id_fkey foreign KEY (gallery_id) references portfolio_galleries (gallery_id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;