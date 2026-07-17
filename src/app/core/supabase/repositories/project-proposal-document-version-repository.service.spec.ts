import { TestBed } from '@angular/core/testing';

import { ProjectProposalDocumentVersion } from '../../models/project-proposal-document-version';
import { testProject } from '../../testing/workflow-fixtures';
import { SupabaseService } from '../clients/supabase.service';
import { ProjectProposalDocumentVersionRepositoryService } from './project-proposal-document-version-repository.service';

describe('ProjectProposalDocumentVersionRepositoryService', () => {
  let service: ProjectProposalDocumentVersionRepositoryService;
  let supabaseService: jasmine.SpyObj<SupabaseService>;
  let client: { from: jasmine.Spy };
  let consoleErrorSpy: jasmine.Spy;

  const documentVersion: ProjectProposalDocumentVersion = {
    project_proposal_document_version_id: 'document-version-test-001',
    project_id: testProject.project_id,
    source_lead_id: testProject.source_lead_id,
    source_floral_proposal_id: 'proposal-test-001',
    invoice_snapshot_id: 'snapshot-test-001',
    version: 2,
    file_name: 'signed-proposal.pdf',
    storage_bucket: 'floral-proposals',
    storage_path: 'projects/project-test-001/proposal-documents/v2.pdf',
    content_type: 'application/pdf',
    file_size_bytes: 1024,
    uploaded_by: 'user-test-001',
    submitted_at: '2026-06-02T12:00:00.000Z',
    is_active: true,
    created_at: '2026-06-02T12:00:00.000Z',
  };

  beforeEach(() => {
    client = { from: jasmine.createSpy('from') };
    supabaseService = jasmine.createSpyObj<SupabaseService>('SupabaseService', [
      'getClient',
    ]);
    supabaseService.getClient.and.returnValue(client as never);

    TestBed.configureTestingModule({
      providers: [
        ProjectProposalDocumentVersionRepositoryService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    });

    service = TestBed.inject(ProjectProposalDocumentVersionRepositoryService);
    consoleErrorSpy = spyOn(console, 'error');
  });

  it('lists project document versions oldest version first for revision display', async () => {
    const query = createSelectEqOrderQuery({
      data: [documentVersion],
      error: null,
    });
    client.from.and.returnValue(query);

    const versions = await service.getProjectDocumentVersions(testProject.project_id);

    expect(client.from).toHaveBeenCalledWith('project_proposal_document_versions');
    expect(query.eq).toHaveBeenCalledWith('project_id', testProject.project_id);
    expect(query.order).toHaveBeenCalledWith('version', { ascending: true });
    expect(versions).toEqual([documentVersion]);
  });

  it('loads the active document version for a project', async () => {
    const query = createSelectEqMaybeSingleQuery({
      data: documentVersion,
      error: null,
    });
    client.from.and.returnValue(query);

    const version = await service.getActiveProjectDocumentVersion(
      testProject.project_id
    );

    expect(query.eq).toHaveBeenCalledWith('project_id', testProject.project_id);
    expect(query.eq).toHaveBeenCalledWith('is_active', true);
    expect(version).toEqual(documentVersion);
  });

  it('creates document versions with private PDF defaults', async () => {
    const query = createInsertSelectSingleQuery({
      data: documentVersion,
      error: null,
    });
    client.from.and.returnValue(query);

    const created = await service.createDocumentVersion({
      project_id: testProject.project_id,
      version: 2,
      file_name: ' signed-proposal.pdf ',
      storage_path: documentVersion.storage_path,
    });

    expect(query.insert).toHaveBeenCalledWith(
      jasmine.objectContaining({
        project_id: testProject.project_id,
        version: 2,
        file_name: 'signed-proposal.pdf',
        storage_bucket: 'floral-proposals',
        content_type: 'application/pdf',
        is_active: true,
      })
    );
    expect(created).toEqual(documentVersion);
  });

  it('returns empty lists and null active versions when reads fail', async () => {
    const error = new Error('read failed');
    client.from.and.returnValues(
      createSelectEqOrderQuery({ data: null, error }),
      createSelectEqMaybeSingleQuery({ data: null, error })
    );

    await expectAsync(
      service.getProjectDocumentVersions(testProject.project_id)
    ).toBeResolvedTo([]);
    await expectAsync(
      service.getActiveProjectDocumentVersion(testProject.project_id)
    ).toBeResolvedTo(null);

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
