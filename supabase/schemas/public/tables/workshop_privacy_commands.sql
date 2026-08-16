create table public.workshop_privacy_commands (
  command_key uuid primary key,
  command_type text not null,
  result jsonb not null,
  actor_id uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.workshop_privacy_commands enable row level security;
create policy workshop_privacy_commands_admin_select
on public.workshop_privacy_commands for select to authenticated
using (public.is_workshop_privacy_admin());
revoke all on public.workshop_privacy_commands from anon;
grant select on public.workshop_privacy_commands to authenticated;
