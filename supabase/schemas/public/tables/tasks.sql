create table public.tasks (
  task_id uuid not null default gen_random_uuid (),
  title text not null,
  description text null,
  related_entity_type public.activity_entity_type null,
  related_entity_id uuid null,
  lead_id uuid null,
  project_id uuid null,
  assigned_user_id uuid null,
  created_by uuid null,
  priority public.task_priority not null default 'medium'::task_priority,
  status public.task_status not null default 'open'::task_status,
  due_at timestamp with time zone null,
  completed_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint tasks_pkey primary key (task_id),
  constraint tasks_assigned_user_id_fkey foreign KEY (assigned_user_id) references profiles (id) on delete set null,
  constraint tasks_created_by_fkey foreign KEY (created_by) references profiles (id) on delete set null,
  constraint tasks_lead_id_fkey foreign KEY (lead_id) references leads (lead_id) on delete CASCADE,
  constraint tasks_project_id_fkey foreign KEY (project_id) references projects (project_id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_tasks_assigned_user_id on public.tasks using btree (assigned_user_id) TABLESPACE pg_default;

create index IF not exists idx_tasks_status on public.tasks using btree (status) TABLESPACE pg_default;

create index IF not exists idx_tasks_due_at on public.tasks using btree (due_at) TABLESPACE pg_default;

create index IF not exists idx_tasks_project_id on public.tasks using btree (project_id) TABLESPACE pg_default;

create index IF not exists idx_tasks_lead_id on public.tasks using btree (lead_id) TABLESPACE pg_default;

create trigger trg_tasks_set_updated_at BEFORE
update on tasks for EACH row
execute FUNCTION set_updated_at ();