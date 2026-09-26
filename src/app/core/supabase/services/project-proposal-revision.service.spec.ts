import { Project } from '../../models/project';
import { ProjectProposalDocumentVersion } from '../../models/project-proposal-document-version';
import { ProjectProposalInvoiceSnapshot } from '../../models/project-proposal-invoice-snapshot';
import { EditableProposalSnapshotV3, ProjectProposalRevisionWorkspace } from '../../models/project-proposal-revision-workspace';
import { ProjectProposalRevisionService } from './project-proposal-revision.service';
import { FloralProposalBuilderService } from './floral-proposal-builder.service';

describe('ProjectProposalRevisionService', () => {
  const project: Project = {
    project_id: 'project-1', project_name: 'Wedding', service_type: 'wedding', status: 'booked',
    event_date: '2026-10-10', active_proposal_invoice_snapshot_id: 'snapshot-1',
    active_proposal_document_version_id: 'document-1', created_at: '', updated_at: '',
  };
  const draft: EditableProposalSnapshotV3 = {
    schema_version: 3, proposal_status: 'draft', tax_region: { tax_region_id: 'tax-1', tax_rate: .06 },
    default_markup_percent: 300,
    financial_terms: { retainer_amount: 30, final_balance_amount: 106 },
    line_items: [{ local_id: 'line-1', display_order: 0, line_item_type: 'product', item_name: 'Bouquet', quantity: 1, calculated_unit_price: 100, actual_unit_price_override: null, unit_price: 100, subtotal: 100, components: [] }],
    shopping_list: [], totals: { subtotal: 100, taxAmount: 6, totalAmount: 106 },
    breakdown: { productsTotal: 100, laborTotal: 0, manualLaborTotal: 0, feesTotal: 0, discountsTotal: 0, subtotal: 100, taxAmount: 6, totalAmount: 106 },
    legacy_labor_conversion: null,
  };
  const productLine = draft.line_items[0] as Extract<EditableProposalSnapshotV3['line_items'][number], { line_item_type: 'product' }>;
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
    schema_version: 3, draft_snapshot: draft, subtotal: 100, tax_rate: .06, tax_amount: 6, total_amount: 106,
    retainer_amount: 30, final_balance_amount: 106, created_at: '', updated_at: '',
  };
  const pricingDraft: EditableProposalSnapshotV3 = {
    ...draft,
    line_items: [{
      ...draft.line_items[0],
      components: [{
        display_order: 0,
        catalog_item_id: 'catalog-rose-1',
        catalog_item_name: 'Red Freedom Rose',
        quantity_per_unit: 10,
        extended_quantity: 10,
        base_unit_cost: 2.9167,
        applied_markup_percent: 300,
        sell_unit_price: 11.67,
        subtotal: 116.70,
        reserve_units: 1,
        pack_quantity: 12,
        effective_pack_cost: 35,
        purchase_unit_cost: 35,
        unit_type: 'bunch',
        snapshot: { pack_quantity: 12, effective_pack_cost: 35 },
      }],
    }],
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

  it('adapts and immediately persists an existing V2 workspace without changing its immutable baseline', async () => {
    const v2Draft = {
      ...draft,
      schema_version: 2,
      labor_percent: 0,
      line_items: [
        {
          ...draft.line_items[0],
          calculated_unit_price: undefined,
          actual_unit_price_override: undefined,
        },
      ],
    };
    const v2Workspace = {
      ...workspace,
      schema_version: 2,
      draft_snapshot: v2Draft,
    } as unknown as ProjectProposalRevisionWorkspace;
    const update = jasmine.createSpy().and.callFake(
      (_id: string, _projectId: string, changes: object) =>
        Promise.resolve({ ...workspace, ...changes })
    );
    const workspaceRepository = {
      getForProject: jasmine.createSpy().and.resolveTo(v2Workspace),
      createOrGet: jasmine.createSpy(),
      update,
      discard: jasmine.createSpy(),
    };
    const { service, deps } = createService({ workspaceRepository });

    const result = await service.loadOrInitialize(project.project_id);

    expect(deps.builderService.adaptProjectSnapshot).toHaveBeenCalledWith(
      v2Draft,
      jasmine.any(Object)
    );
    expect(update).toHaveBeenCalledOnceWith(
      'workspace-1',
      'project-1',
      jasmine.objectContaining({
        schema_version: 3,
        draft_snapshot: draft,
        pending_submission_key: null,
      })
    );
    expect(result.workspace.schema_version).toBe(3);
    expect(result.activeSnapshot).toBe(snapshot);
    expect(result.activeSnapshot.snapshot).toBe(snapshot.snapshot);
  });

  it('reopens a saved revision containing an unused blank line and persists the clean draft', async () => {
    const blank = {
      local_id: 'empty-line', display_order: 1, line_item_type: 'product',
      item_name: '', quantity: 1, calculated_unit_price: 0,
      actual_unit_price_override: null, unit_price: 0, subtotal: 0, components: [],
    };
    const saved = {
      ...workspace,
      draft_snapshot: { ...draft, line_items: [...draft.line_items, blank] },
    } as unknown as ProjectProposalRevisionWorkspace;
    const update = jasmine.createSpy().and.callFake(
      (_id: string, _projectId: string, changes: object) => Promise.resolve({ ...saved, ...changes })
    );
    const workspaceRepository = {
      getForProject: jasmine.createSpy().and.resolveTo(saved),
      createOrGet: jasmine.createSpy(), update,
      discard: jasmine.createSpy(),
    };
    const { service } = createService({
      workspaceRepository, builderService: new FloralProposalBuilderService(),
    });

    const loaded = await service.loadOrInitialize(project.project_id);

    expect(loaded.workspace.draft_snapshot.line_items).toHaveSize(1);
    expect(loaded.workspace.draft_snapshot.totals.totalAmount).toBe(106);
    expect(loaded.compatibilityWarning).toContain('blank');
    expect(update).toHaveBeenCalled();
    expect(saved.draft_snapshot.line_items).toHaveSize(2);
  });

  it('opens an unnamed priced row for repair without dropping its value or autosaving it', async () => {
    const unnamed = {
      local_id: 'needs-name', display_order: 1, line_item_type: 'product',
      item_name: '', quantity: 1, calculated_unit_price: 25,
      actual_unit_price_override: null, unit_price: 25, subtotal: 25, components: [],
    };
    const repairDraft = {
      ...draft,
      schema_version: 2,
      tax_region: { tax_region_id: null, tax_rate: 0 },
      line_items: [...draft.line_items, unnamed],
      totals: { subtotal: 125, taxAmount: 0, totalAmount: 125 },
    };
    const saved = {
      ...workspace, schema_version: 2, draft_snapshot: repairDraft,
      subtotal: 125, tax_rate: 0, tax_amount: 0, total_amount: 125,
    } as unknown as ProjectProposalRevisionWorkspace;
    const update = jasmine.createSpy();
    const workspaceRepository = {
      getForProject: jasmine.createSpy().and.resolveTo(saved),
      createOrGet: jasmine.createSpy(), update, discard: jasmine.createSpy(),
    };
    const { service } = createService({
      workspaceRepository, builderService: new FloralProposalBuilderService(),
    });

    const loaded = await service.loadOrInitialize(project.project_id);

    expect(loaded.workspace.draft_snapshot.line_items[1]).toEqual(
      jasmine.objectContaining({ item_name: '', subtotal: 25 })
    );
    expect(loaded.compatibilityWarning).toContain('name');
    expect(update).not.toHaveBeenCalled();
  });

  it('blocks an unsafe workspace repair without persisting it', async () => {
    const existingRepo = {
      getForProject: jasmine.createSpy().and.resolveTo({ ...workspace, schema_version: 2 }),
      createOrGet: jasmine.createSpy(),
      update: jasmine.createSpy(),
      discard: jasmine.createSpy(),
    };
    const builderService = {
      adaptProjectSnapshot: jasmine.createSpy().and.returnValue({
        valid: false,
        repairMessage: 'Legacy labor does not reconcile to the recorded total.',
      }),
    };
    const { service } = createService({
      workspaceRepository: existingRepo,
      builderService,
    });

    await expectAsync(service.loadOrInitialize(project.project_id)).toBeRejectedWithError(
      'Legacy labor does not reconcile to the recorded total.'
    );
    expect(existingRepo.update).not.toHaveBeenCalled();
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

  it('preserves four-decimal row pricing and additive pack facts through autosave and resume', async () => {
    jasmine.clock().install();
    try {
      const { service, deps } = createService();
      service.queueAutosave(workspace, pricingDraft);
      jasmine.clock().tick(750);

      const saved = await service.flushAutosave();
      const persistedDraft = deps.workspaceRepository.update.calls.mostRecent().args[2]
        .draft_snapshot as EditableProposalSnapshotV3;
      const persistedComponent = persistedDraft.line_items[0].components[0];

      expect(saved).not.toBeNull();
      expect(saved!.draft_snapshot.schema_version).toBe(3);
      expect(persistedDraft.schema_version).toBe(3);
      expect(persistedComponent.base_unit_cost).toBe(2.9167);
      expect(persistedComponent.pack_quantity).toBe(12);
      expect(persistedComponent.effective_pack_cost).toBe(35);
      expect(persistedComponent.snapshot).toEqual(jasmine.objectContaining({
        pack_quantity: 12,
        effective_pack_cost: 35,
      }));
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
    service.queueAutosave(workspace, pricingDraft);
    await expectAsync(service.flushAutosave()).toBeRejected();
    expect(service.saveState()).toBe('error');
    update.and.resolveTo(workspace);
    await expectAsync(service.retryAutosave(workspace, pricingDraft)).toBeResolvedTo(workspace);
    expect(service.saveState()).toBe('saved');
    expect(update.calls.mostRecent().args[2].draft_snapshot.line_items[0].components[0])
      .toEqual(jasmine.objectContaining({
        base_unit_cost: 2.9167,
        pack_quantity: 12,
        effective_pack_cost: 35,
      }));
  });

  it('persists the exact submission draft even when a stale autosave is queued', async () => {
    const { service, deps } = createService();
    const currentDraft: EditableProposalSnapshotV3 = {
      ...draft,
      financial_terms: { ...draft.financial_terms, retainer_amount: 1599.9, final_balance_amount: 5333 },
      line_items: [{
        ...productLine,
        calculated_unit_price: 5031.13,
        unit_price: 5031.13,
        subtotal: 5031.13,
      }],
      totals: { subtotal: 5031.13, taxAmount: 301.87, totalAmount: 5333 },
      breakdown: {
        ...draft.breakdown,
        productsTotal: 5031.13,
        subtotal: 5031.13,
        taxAmount: 301.87,
        totalAmount: 5333,
      },
    };
    service.queueAutosave(workspace, draft);

    const saved = await service.saveNow(workspace, currentDraft);

    expect(deps.workspaceRepository.update).toHaveBeenCalledTimes(1);
    expect(deps.workspaceRepository.update).toHaveBeenCalledWith(
      'workspace-1', 'project-1', jasmine.objectContaining({
        total_amount: 5333,
        subtotal: 5031.13,
        tax_amount: 301.87,
        draft_snapshot: currentDraft,
      })
    );
    expect(saved.total_amount).toBe(5333);
  });

  it('stops submission when storage returns totals different from the current draft', async () => {
    const staleRepository = {
      getForProject: jasmine.createSpy(),
      createOrGet: jasmine.createSpy(),
      update: jasmine.createSpy().and.resolveTo(workspace),
      discard: jasmine.createSpy(),
    };
    const { service } = createService({ workspaceRepository: staleRepository });
    const revised: EditableProposalSnapshotV3 = {
      ...draft,
      line_items: [{ ...productLine, calculated_unit_price: 200, unit_price: 200, subtotal: 200 }],
      financial_terms: { ...draft.financial_terms, retainer_amount: 63.6, final_balance_amount: 212 },
      totals: { subtotal: 200, taxAmount: 12, totalAmount: 212 },
      breakdown: { ...draft.breakdown, productsTotal: 200, subtotal: 200, taxAmount: 12, totalAmount: 212 },
    };

    await expectAsync(service.saveNow(workspace, revised)).toBeRejectedWithError(
      'The revised proposal totals did not save correctly. The PDF was not submitted.'
    );
  });

  it('reports an inconsistent V3 autosave before the workspace repository is called', async () => {
    const update = jasmine.createSpy();
    const repo = {
      getForProject: jasmine.createSpy(),
      createOrGet: jasmine.createSpy(),
      update,
      discard: jasmine.createSpy(),
    };
    const { service } = createService({ workspaceRepository: repo });
    const invalidDraft = {
      ...draft,
      line_items: [
        {
          ...draft.line_items[0],
          actual_unit_price_override: 125,
          unit_price: 100,
        },
      ],
    } as EditableProposalSnapshotV3;

    service.queueAutosave(workspace, invalidDraft);

    expect(await service.flushAutosave()).toBeNull();
    expect(update).not.toHaveBeenCalled();
    expect(service.saveState()).toBe('error');
    expect(service.saveError()).toContain('effective unit price');
  });

  it('keeps a priced unnamed row for repair, then saves it after it is named', async () => {
    const { service, deps } = createService();
    const unnamedDraft: EditableProposalSnapshotV3 = {
      ...draft,
      line_items: [{ ...productLine, item_name: '' }],
    };

    service.queueAutosave(workspace, unnamedDraft);
    expect(service.saveState()).toBe('error');
    expect(service.saveError()).toContain('has no name');
    expect(await service.flushAutosave()).toBeNull();
    expect(deps.workspaceRepository.update).not.toHaveBeenCalled();

    service.queueAutosave(workspace, { ...unnamedDraft, line_items: [{ ...productLine, item_name: 'Bouquet' }] });
    await service.flushAutosave();
    expect(service.saveState()).toBe('saved');
    expect(deps.workspaceRepository.update).toHaveBeenCalledTimes(1);
  });
});
