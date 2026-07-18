import { TestBed } from '@angular/core/testing';
import { ProjectProposalRevisionWorkspace } from '../../models/project-proposal-revision-workspace';
import { SupabaseService } from '../clients/supabase.service';
import { ProjectProposalRevisionWorkspaceRepositoryService } from './project-proposal-revision-workspace-repository.service';

describe('ProjectProposalRevisionWorkspaceRepositoryService', () => {
  let service: ProjectProposalRevisionWorkspaceRepositoryService;
  let client: { from: jasmine.Spy };
  const workspace = {
    project_proposal_revision_workspace_id: 'workspace-1', project_id: 'project-1', baseline_invoice_snapshot_id: 'snapshot-1',
    schema_version: 2, draft_snapshot: { schema_version: 2 }, subtotal: 100, tax_rate: .06, tax_amount: 6,
    total_amount: 106, retainer_amount: 30, final_balance_amount: 106, created_at: '', updated_at: '',
  } as unknown as ProjectProposalRevisionWorkspace;

  beforeEach(() => {
    client = { from: jasmine.createSpy('from') };
    const supabase = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getClient']);
    supabase.getClient.and.returnValue(client as never);
    TestBed.configureTestingModule({ providers: [ProjectProposalRevisionWorkspaceRepositoryService, { provide: SupabaseService, useValue: supabase }] });
    service = TestBed.inject(ProjectProposalRevisionWorkspaceRepositoryService);
  });

  it('gets the single project-owned workspace and propagates read errors', async () => {
    const query = selectEqMaybe({ data: workspace, error: null });
    client.from.and.returnValue(query);
    expect(await service.getForProject('project-1')).toBe(workspace);
    expect(query.eq).toHaveBeenCalledWith('project_id', 'project-1');

    client.from.and.returnValue(selectEqMaybe({ data: null, error: new Error('read failed') }));
    await expectAsync(service.getForProject('project-1')).toBeRejected();
  });

  it('returns the winning workspace after a one-row-per-project unique conflict', async () => {
    client.from.and.returnValues(
      insertSelectSingle({ data: null, error: { code: '23505' } }),
      selectEqMaybe({ data: workspace, error: null })
    );
    expect(await service.createOrGet(workspace as any)).toBe(workspace);
  });

  it('updates pending metadata and scopes mutations by workspace and project', async () => {
    const query = updateEqSelectSingle({ data: { ...workspace, pending_submission_key: 'key' }, error: null });
    client.from.and.returnValue(query);
    const updated = await service.update('workspace-1', 'project-1', { pending_submission_key: 'key' });
    expect(updated.pending_submission_key).toBe('key');
    expect(query.eq).toHaveBeenCalledWith('project_proposal_revision_workspace_id', 'workspace-1');
    expect(query.eq).toHaveBeenCalledWith('project_id', 'project-1');
  });

  it('deletes only the selected project workspace and propagates failures', async () => {
    const query = deleteEq({ error: null });
    client.from.and.returnValue(query);
    await service.discard('workspace-1', 'project-1');
    expect(query.eq).toHaveBeenCalledWith('project_id', 'project-1');

    client.from.and.returnValue(deleteEq({ error: new Error('delete failed') }));
    await expectAsync(service.discard('workspace-1', 'project-1')).toBeRejected();
  });
});

function selectEqMaybe(result: unknown) {
  const q = { select: jasmine.createSpy(), eq: jasmine.createSpy(), maybeSingle: jasmine.createSpy() };
  q.select.and.returnValue(q); q.eq.and.returnValue(q); q.maybeSingle.and.resolveTo(result); return q;
}
function insertSelectSingle(result: unknown) {
  const q = { insert: jasmine.createSpy(), select: jasmine.createSpy(), single: jasmine.createSpy() };
  q.insert.and.returnValue(q); q.select.and.returnValue(q); q.single.and.resolveTo(result); return q;
}
function updateEqSelectSingle(result: unknown) {
  const q = { update: jasmine.createSpy(), eq: jasmine.createSpy(), select: jasmine.createSpy(), single: jasmine.createSpy() };
  q.update.and.returnValue(q); q.eq.and.returnValue(q); q.select.and.returnValue(q); q.single.and.resolveTo(result); return q;
}
function deleteEq(result: unknown) {
  const q = { delete: jasmine.createSpy(), eq: jasmine.createSpy() };
  q.delete.and.returnValue(q); q.eq.and.returnValue({ ...q, then: (resolve: (value: unknown) => void) => resolve(result) }); return q;
}
