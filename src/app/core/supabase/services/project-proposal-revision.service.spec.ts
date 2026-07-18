import { Project } from '../../models/project';
import { ProjectProposalDocumentVersion } from '../../models/project-proposal-document-version';
import { ProjectProposalInvoiceSnapshot } from '../../models/project-proposal-invoice-snapshot';
import { EditableProposalSnapshotV2, ProjectProposalRevisionWorkspace } from '../../models/project-proposal-revision-workspace';
import { ProjectProposalRevisionService } from './project-proposal-revision.service';

describe('ProjectProposalRevisionService', () => {
  const project: Project = {
    project_id: 'project-1', project_name: 'Wedding', service_type: 'wedding', status: 'booked',
    event_date: '2026-10-10', active_proposal_invoice_snapshot_id: 'snapshot-1',
    active_proposal_document_version_id: 'document-1', created_at: '', updated_at: '',
  };
  const draft: EditableProposalSnapshotV2 = {
    schema_version: 2, proposal_status: 'draft', tax_region: { tax_region_id: 'tax-1', tax_rate: .06 },
    default_markup_percent: 300, labor_percent: 0,
    financial_terms: { retainer_amount: 30, final_balance_amount: 106 },
    line_items: [{ local_id: 'line-1', display_order: 0, line_item_type: 'product', item_name: 'Bouquet', quantity: 1, unit_price: 100, subtotal: 100, components: [] }],
    shopping_list: [], totals: { subtotal: 100, taxAmount: 6, totalAmount: 106 }, breakdown: {},
  };
  const snapshot: ProjectProposalInvoiceSnapshot = {
    project_proposal_invoice_snapshot_id: 'snapshot-1', project_id: 'project-1', version: 1,
    snapshot: draft, subtotal: 100, tax_rate: .06, tax_amount: 6, total_amount: 106,
    retainer_amount: 30, final_balance_amount: 106, is_active: true, created_at: '',
  };
  const document: ProjectProposalDocumentVersion = {
    project_proposal_document_version_id: 'document-1', project_id: 'project-1', invoice_snapshot_id: 'snapshot-1',
    version: 1, file_name: 'proposal.pdf', storage_bucket: 'floral-proposals', storage_path: 'proposal.pdf',
    content_type: 'application/pdf', submitted_at: '', is_active: true, status: 'submitted', created_at: '',
  };
  const workspace: ProjectProposalRevisionWorkspace = {
    project_proposal_revision_workspace_id: 'workspace-1', project_id: 'project-1', baseline_invoice_snapshot_id: 'snapshot-1',
    schema_version: 2, draft_snapshot: draft, subtotal: 100, tax_rate: .06, tax_amount: 6, total_amount: 106,
    retainer_amount: 30, final_balance_amount: 106, created_at: '', updated_at: '',
  };

  function createService(overrides: Record<string, unknown> = {}) {
    const deps = {
      projectRepository: { getProjectById: jasmine.createSpy().and.resolveTo(project) },
      snapshotRepository: { getProjectSnapshots: jasmine.createSpy().and.resolveTo([snapshot]) },
      documentRepository: { getProjectDocumentVersions: jasmine.createSpy().and.resolveTo([document]) },
      workspaceRepository: {
        getForProject: jasmine.createSpy().and.resolveTo(null),
        createOrGet: jasmine.createSpy().and.resolveTo(workspace),
        update: jasmine.createSpy().and.callFake((_id: string, _projectId: string, changes: object) => Promise.resolve({ ...workspace, ...changes })),
        discard: jasmine.createSpy().and.resolveTo(),
      },
      builderService: { adaptProjectSnapshot: jasmine.createSpy().and.returnValue({ valid: true, draft }) },
      supabaseService: { getUser: jasmine.createSpy().and.resolveTo({ id: 'user-1' }) },
      ...overrides,
    } as any;
    return { service: new ProjectProposalRevisionService(deps.projectRepository, deps.snapshotRepository, deps.documentRepository, deps.workspaceRepository, deps.builderService, deps.supabaseService), deps };
  }

  it('accepts every active workflow status and rejects terminal status', () => {
    const { service } = createService();
    for (const status of ['awaiting_deposit', 'booked', 'awaiting_final_payment', 'final_prep'] as const) {
      expect(service.resolveSnapshotState({ ...project, status }, [snapshot]).state).toBe('valid');
    }
    expect(service.resolveSnapshotState({ ...project, status: 'completed' }, [snapshot]).state).toBe('ineligible_project_status');
    expect(service.resolveSnapshotState({ ...project, status: 'canceled' }, [snapshot]).state).toBe('ineligible_project_status');
  });

  it('distinguishes missing, conflicting, broken snapshot and document states', () => {
    const { service } = createService();
    expect(service.resolveSnapshotState(project, []).state).toBe('missing_snapshot');
    expect(service.resolveSnapshotState(project, [snapshot, { ...snapshot, project_proposal_invoice_snapshot_id: 'snapshot-2' }]).state).toBe('conflicting_snapshots');
    expect(service.resolveSnapshotState({ ...project, active_proposal_invoice_snapshot_id: 'wrong' }, [snapshot]).state).toBe('broken_snapshot_reference');
    expect(service.resolveDocumentState({ ...project, active_proposal_document_version_id: null }, snapshot, []).state).toBe('missing_document');
    expect(service.resolveDocumentState(project, snapshot, [{ ...document, invoice_snapshot_id: 'wrong' }]).state).toBe('mismatched_snapshot_document_pair');
  });

  it('initializes only from the active snapshot and resumes an existing matching workspace', async () => {
    const first = createService();
    await expectAsync(first.service.loadOrInitialize(project.project_id)).toBeResolved();
    expect(first.deps.builderService.adaptProjectSnapshot).toHaveBeenCalledWith(snapshot.snapshot, jasmine.any(Object));
    expect(first.deps.workspaceRepository.createOrGet).toHaveBeenCalled();

    const existingRepo = {
      ...first.deps.workspaceRepository,
      getForProject: jasmine.createSpy().and.resolveTo(workspace),
      createOrGet: jasmine.createSpy().and.resolveTo(workspace),
    };
    const resumed = createService({ workspaceRepository: existingRepo });
    const result = await resumed.service.loadOrInitialize(project.project_id);
    expect(result.workspace).toBe(workspace);
    expect(existingRepo.createOrGet).not.toHaveBeenCalled();
  });

  it('debounces autosave, persists only the last payload, resets pending metadata, and exposes save state', async () => {
    jasmine.clock().install();
    try {
      const { service, deps } = createService();
      service.queueAutosave(workspace, draft);
      service.queueAutosave(workspace, { ...draft, default_markup_percent: 325 });
      jasmine.clock().tick(749);
      expect(deps.workspaceRepository.update).not.toHaveBeenCalled();
      jasmine.clock().tick(1);
      await service.flushAutosave();
      expect(deps.workspaceRepository.update).toHaveBeenCalledTimes(1);
      expect(deps.workspaceRepository.update).toHaveBeenCalledWith('workspace-1', 'project-1', jasmine.objectContaining({
        draft_snapshot: jasmine.objectContaining({ default_markup_percent: 325 }), pending_submission_key: null,
      }));
      expect(service.saveState()).toBe('saved');
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('reuses a matching pending submission attempt and discards project-scoped workspaces', async () => {
    const { service, deps } = createService();
    const pending = { ...workspace, pending_submission_key: 'key-1', pending_pdf_storage_path: 'path.pdf', pending_pdf_file_name: 'proposal.pdf' };
    expect(await service.prepareSubmission(pending, 'proposal.pdf')).toBe(pending);
    await service.discard(workspace);
    expect(deps.workspaceRepository.discard).toHaveBeenCalledWith('workspace-1', 'project-1');
  });

  it('recovers its ordered save chain after an autosave failure and supports explicit retry', async () => {
    const update = jasmine.createSpy().and.rejectWith(new Error('offline'));
    const repo = { getForProject: jasmine.createSpy(), createOrGet: jasmine.createSpy(), update, discard: jasmine.createSpy() };
    const { service } = createService({ workspaceRepository: repo });
    service.queueAutosave(workspace, draft);
    await expectAsync(service.flushAutosave()).toBeRejected();
    expect(service.saveState()).toBe('error');
    update.and.resolveTo(workspace);
    await expectAsync(service.retryAutosave(workspace, draft)).toBeResolvedTo(workspace);
    expect(service.saveState()).toBe('saved');
  });
});
