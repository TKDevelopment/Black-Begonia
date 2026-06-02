create table public.leads (
  lead_id uuid not null default gen_random_uuid (),
  service_type public.service_type not null,
  event_type text null,
  first_name text not null,
  last_name text not null,
  partner_first_name text null,
  partner_last_name text null,
  email text not null,
  phone text null,
  preferred_contact_method public.preferred_contact_method null,
  event_date date null,
  ceremony_venue_name text null,
  ceremony_venue_city text null,
  ceremony_venue_state text null,
  budget_range text null,
  guest_count integer null,
  inquiry_message text null,
  source public.lead_sources not null default 'other'::lead_sources,
  status public.lead_status not null default 'new'::lead_status,
  assigned_user_id uuid null,
  decline_reason text null,
  converted_project_id uuid null,
  converted_primary_contact_id uuid null,
  converted_at timestamp with time zone null,
  declined_at timestamp with time zone null,
  last_contacted_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  reception_venue_name text null,
  reception_venue_city text null,
  reception_venue_state text null,
  consultation_completed_at timestamp with time zone null,
  consultation_scheduled_at timestamp with time zone null,
  planner_name text null,
  planner_phone text null,
  planner_email text null,
  reception_start_time time without time zone null,
  ceremony_start_time time without time zone null,
  event_start_time time without time zone null,
  constraint leads_pkey primary key (lead_id),
  constraint leads_assigned_user_id_fkey foreign KEY (assigned_user_id) references profiles (id) on delete set null,
  constraint leads_converted_primary_contact_id_fkey foreign KEY (converted_primary_contact_id) references contacts (contact_id) on delete set null,
  constraint leads_converted_project_id_fkey foreign KEY (converted_project_id) references projects (project_id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_leads_status on public.leads using btree (status) TABLESPACE pg_default;

create index IF not exists idx_leads_created_at_desc on public.leads using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists idx_leads_email on public.leads using btree (email) TABLESPACE pg_default;

create index IF not exists idx_leads_event_date on public.leads using btree (event_date) TABLESPACE pg_default;

create index IF not exists idx_leads_assigned_user_id on public.leads using btree (assigned_user_id) TABLESPACE pg_default;

create trigger trg_leads_log_new_lead_activity
after INSERT on leads for EACH row
execute FUNCTION log_new_lead_activity ();

create trigger trg_leads_set_updated_at BEFORE
update on leads for EACH row
execute FUNCTION set_updated_at ();