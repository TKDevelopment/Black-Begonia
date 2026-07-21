import { TestBed } from '@angular/core/testing';

import { testProject } from '../../testing/workflow-fixtures';
import { SupabaseService } from '../clients/supabase.service';
import { ProjectRepositoryService } from './project-repository.service';

describe('ProjectRepositoryService', () => {
  let service: ProjectRepositoryService;
  let supabaseService: jasmine.SpyObj<SupabaseService>;
  let client: { from: jasmine.Spy; rpc: jasmine.Spy; storage: { from: jasmine.Spy } };
  let storageRemove: jasmine.Spy;
  let consoleErrorSpy: jasmine.Spy;

  beforeEach(() => {
    storageRemove = jasmine.createSpy('remove').and.resolveTo({ error: null });
    client = {
      from: jasmine.createSpy('from'),
      rpc: jasmine.createSpy('rpc').and.resolveTo({ error: null }),
      storage: {
        from: jasmine.createSpy('storage.from').and.returnValue({ remove: storageRemove }),
      },
    };
    supabaseService = jasmine.createSpyObj<SupabaseService>('SupabaseService', [
      'getClient',
    ]);
    supabaseService.getClient.and.returnValue(client as never);

    TestBed.configureTestingModule({
      providers: [
        ProjectRepositoryService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    });

    service = TestBed.inject(ProjectRepositoryService);
    consoleErrorSpy = spyOn(console, 'error');
  });

  it('loads projects with active proposal snapshot and document references', async () => {
    const project = {
      ...testProject,
      active_proposal_invoice_snapshot_id: 'snapshot-test-001',
      active_proposal_document_version_id: 'document-version-test-001',
    };
    const query = createSelectOrderQuery({ data: [project], error: null });
    client.from.and.returnValue(query);

    const projects = await service.getProjects();

    expect(client.from).toHaveBeenCalledWith('projects');
    expect(client.rpc).toHaveBeenCalledWith('refresh_project_payment_statuses', {
      target_project_id: null,
    });
    expect(query.select).toHaveBeenCalledWith(
      jasmine.stringMatching('active_proposal_invoice_snapshot_id')
    );
    expect(query.select).toHaveBeenCalledWith(
      jasmine.stringMatching('active_proposal_document_version_id')
    );
    expect(projects[0].active_proposal_invoice_snapshot_id).toBe(
      'snapshot-test-001'
    );
    expect(projects[0].active_proposal_document_version_id).toBe(
      'document-version-test-001'
    );
  });

  it('creates and updates projects with active proposal reference fields', async () => {
    const createQuery = createInsertSelectSingleQuery({
      data: testProject,
      error: null,
    });
    const updateQuery = createUpdateEqSelectSingleQuery({
      data: {
        ...testProject,
        active_proposal_invoice_snapshot_id: 'snapshot-test-002',
      },
      error: null,
    });
    client.from.and.returnValues(createQuery, updateQuery);

    await service.createProject({
      project_name: ' Avery Project ',
      service_type: 'wedding',
      active_proposal_invoice_snapshot_id: 'snapshot-test-001',
      active_proposal_document_version_id: 'document-version-test-001',
    });
    const updated = await service.updateProject(testProject.project_id, {
      active_proposal_invoice_snapshot_id: 'snapshot-test-002',
    });

    expect(createQuery.insert).toHaveBeenCalledWith(
      jasmine.objectContaining({
        project_name: 'Avery Project',
        active_proposal_invoice_snapshot_id: 'snapshot-test-001',
        active_proposal_document_version_id: 'document-version-test-001',
      })
    );
    expect(updateQuery.update).toHaveBeenCalledWith(
      jasmine.objectContaining({
        active_proposal_invoice_snapshot_id: 'snapshot-test-002',
        updated_at: jasmine.any(String),
      })
    );
    expect(updateQuery.eq).toHaveBeenCalledWith(
      'project_id',
      testProject.project_id
    );
    expect(updated.active_proposal_invoice_snapshot_id).toBe('snapshot-test-002');
  });

  it('returns empty project lists and logs repository failures', async () => {
    const error = new Error('list failed');
    client.from.and.returnValue(createSelectOrderQuery({ data: null, error }));

    const projects = await service.getProjects();

    expect(projects).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ProjectRepositoryService] getProjects error:',
      error
    );
  });

  it('loads a single project after refreshing its payment status', async () => {
    const query = createSelectEqMaybeSingleQuery({ data: testProject, error: null });
    client.from.and.returnValue(query);

    const project = await service.getProjectById(testProject.project_id);

    expect(client.rpc).toHaveBeenCalledWith('refresh_project_payment_statuses', {
      target_project_id: testProject.project_id,
    });
    expect(query.eq).toHaveBeenCalledWith('project_id', testProject.project_id);
    expect(project).toEqual(testProject);
  });

  it('uses the guarded cascade RPC and removes returned proposal files by bucket', async () => {
    client.rpc.and.resolveTo({
      data: {
        projectId: testProject.project_id,
        projectName: testProject.project_name,
        deletedSourceLead: true,
        deletedContacts: 1,
        deletedOrganizations: 0,
        storageObjects: [
          { bucket: 'floral-proposals', path: 'projects/test/one.pdf' },
          { bucket: 'floral-proposals', path: 'projects/test/two.pdf' },
        ],
      },
      error: null,
    });

    const result = await service.cascadeDeleteProjectTestData(
      testProject.project_id,
      testProject.project_name
    );

    expect(client.rpc).toHaveBeenCalledWith('cascade_delete_project_test_data', {
      p_project_id: testProject.project_id,
      p_confirmation: testProject.project_name,
    });
    expect(client.storage.from).toHaveBeenCalledWith('floral-proposals');
    expect(storageRemove).toHaveBeenCalledWith([
      'projects/test/one.pdf',
      'projects/test/two.pdf',
    ]);
    expect(result.storageCleanupFailures).toBe(0);
  });
});

function createSelectOrderQuery(result: unknown) {
  const query = {
    select: jasmine.createSpy('select'),
    order: jasmine.createSpy('order'),
  };
  query.select.and.returnValue(query);
  query.order.and.resolveTo(result);
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

function createUpdateEqSelectSingleQuery(result: unknown) {
  const query = {
    update: jasmine.createSpy('update'),
    eq: jasmine.createSpy('eq'),
    select: jasmine.createSpy('select'),
    single: jasmine.createSpy('single'),
  };
  query.update.and.returnValue(query);
  query.eq.and.returnValue(query);
  query.select.and.returnValue(query);
  query.single.and.resolveTo(result);
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
