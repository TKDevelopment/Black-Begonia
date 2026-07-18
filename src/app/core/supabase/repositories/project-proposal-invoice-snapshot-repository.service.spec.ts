import { TestBed } from '@angular/core/testing';

import { ProjectProposalInvoiceSnapshot } from '../../models/project-proposal-invoice-snapshot';
import { testProject } from '../../testing/workflow-fixtures';
import { SupabaseService } from '../clients/supabase.service';
import { ProjectProposalInvoiceSnapshotRepositoryService } from './project-proposal-invoice-snapshot-repository.service';

describe('ProjectProposalInvoiceSnapshotRepositoryService', () => {
  let service: ProjectProposalInvoiceSnapshotRepositoryService;
  let supabaseService: jasmine.SpyObj<SupabaseService>;
  let client: { from: jasmine.Spy };
  let consoleErrorSpy: jasmine.Spy;

  const snapshot: ProjectProposalInvoiceSnapshot = {
    project_proposal_invoice_snapshot_id: 'snapshot-test-001',
    project_id: testProject.project_id,
    source_lead_id: testProject.source_lead_id,
    source_floral_proposal_id: 'proposal-test-001',
    version: 2,
    snapshot: { proposal_status: 'finalized' },
    subtotal: 1000,
    tax_rate: 0.08,
    tax_amount: 80,
    total_amount: 1080,
    retainer_amount: 324,
    final_balance_amount: 756,
    retainer_due_date: null,
    final_balance_due_date: '2026-10-01',
    created_by: 'user-test-001',
    created_at: '2026-06-02T12:00:00.000Z',
    is_active: true,
  };

  beforeEach(() => {
    client = { from: jasmine.createSpy('from') };
    supabaseService = jasmine.createSpyObj<SupabaseService>('SupabaseService', [
      'getClient',
    ]);
    supabaseService.getClient.and.returnValue(client as never);

    TestBed.configureTestingModule({
      providers: [
        ProjectProposalInvoiceSnapshotRepositoryService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    });

    service = TestBed.inject(ProjectProposalInvoiceSnapshotRepositoryService);
    consoleErrorSpy = spyOn(console, 'error');
  });

  it('lists project invoice snapshots oldest version first for comparison', async () => {
    const query = createSelectEqOrderQuery({
      data: [snapshot],
      error: null,
    });
    client.from.and.returnValue(query);

    const snapshots = await service.getProjectSnapshots(testProject.project_id);

    expect(client.from).toHaveBeenCalledWith('project_proposal_invoice_snapshots');
    expect(query.eq).toHaveBeenCalledWith('project_id', testProject.project_id);
    expect(query.order).toHaveBeenCalledWith('version', { ascending: true });
    expect(snapshots).toEqual([snapshot]);
  });

  it('loads the active invoice snapshot for a project', async () => {
    const query = createSelectEqMaybeSingleQuery({
      data: snapshot,
      error: null,
    });
    client.from.and.returnValue(query);

    const activeSnapshot = await service.getActiveProjectSnapshot(
      testProject.project_id
    );

    expect(query.eq).toHaveBeenCalledWith('project_id', testProject.project_id);
    expect(query.eq).toHaveBeenCalledWith('is_active', true);
    expect(activeSnapshot).toEqual(snapshot);
  });

  it('creates invoice snapshots with financial defaults and active state', async () => {
    const query = createInsertSelectSingleQuery({
      data: snapshot,
      error: null,
    });
    client.from.and.returnValue(query);

    const created = await service.createSnapshot({
      project_id: testProject.project_id,
      version: 2,
      total_amount: 1080,
    });

    expect(query.insert).toHaveBeenCalledWith(
      jasmine.objectContaining({
        project_id: testProject.project_id,
        version: 2,
        snapshot: {},
        subtotal: 0,
        tax_rate: 0,
        tax_amount: 0,
        total_amount: 1080,
        final_balance_amount: 1080,
        is_active: true,
      })
    );
    expect(created).toEqual(snapshot);
  });

  it('propagates read failures so financial consumers cannot treat errors as missing data', async () => {
    const error = new Error('read failed');
    client.from.and.returnValues(
      createSelectEqOrderQuery({ data: null, error }),
      createSelectEqMaybeSingleQuery({ data: null, error })
    );

    await expectAsync(service.getProjectSnapshots(testProject.project_id)).toBeRejected();
    await expectAsync(service.getActiveProjectSnapshot(testProject.project_id)).toBeRejected();

    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

function createSelectEqOrderQuery(result: unknown) {
  const query = {
    select: jasmine.createSpy('select'),
    eq: jasmine.createSpy('eq'),
    order: jasmine.createSpy('order'),
  };
  query.select.and.returnValue(query);
  query.eq.and.returnValue(query);
  query.order.and.resolveTo(result);
  return query;
}

function createSelectEqMaybeSingleQuery(result: unknown) {
  const query = {
    select: jasmine.createSpy('select'),
    eq: jasmine.createSpy('eq'),
    maybeSingle: jasmine.createSpy('maybeSingle'),
  };
  query.select.and.returnValue(query);
  query.eq.and.returnValue(query);
  query.maybeSingle.and.resolveTo(result);
  return query;
}

function createInsertSelectSingleQuery(result: unknown) {
  const query = {
    insert: jasmine.createSpy('insert'),
    select: jasmine.createSpy('select'),
    single: jasmine.createSpy('single'),
  };
  query.insert.and.returnValue(query);
  query.select.and.returnValue(query);
  query.single.and.resolveTo(result);
  return query;
}
