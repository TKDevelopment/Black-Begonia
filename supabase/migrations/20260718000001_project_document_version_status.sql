begin;

alter table public.project_proposal_document_versions
  add column if not exists status text not null default 'submitted';

alter table public.project_proposal_document_versions
  drop constraint if exists project_proposal_document_versions_status_check;

alter table public.project_proposal_document_versions
  add constraint project_proposal_document_versions_status_check
  check (status in ('submitted', 'superseded', 'archived'));

commit;
