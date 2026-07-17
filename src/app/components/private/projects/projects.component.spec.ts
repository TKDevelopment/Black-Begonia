import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';

import { ProjectProposalDocumentVersion } from '../../../core/models/project-proposal-document-version';
import { ProjectRepositoryService } from '../../../core/supabase/repositories/project-repository.service';
import { ProjectProposalDocumentVersionRepositoryService } from '../../../core/supabase/repositories/project-proposal-document-version-repository.service';
import { SupabaseService } from '../../../core/supabase/clients/supabase.service';
import { testProject } from '../../../core/testing/workflow-fixtures';
import { ProjectsComponent } from './projects.component';

describe('ProjectsComponent', () => {
  let component: ProjectsComponent;
  let fixture: ComponentFixture<ProjectsComponent>;
  let projectRepository: jasmine.SpyObj<ProjectRepositoryService>;
  let documentRepository: jasmine.SpyObj<ProjectProposalDocumentVersionRepositoryService>;
  let router: jasmine.SpyObj<Router>;
  let storageApi: { createSignedUrl: jasmine.Spy };
  let consoleErrorSpy: jasmine.Spy;

  const documentVersion: ProjectProposalDocumentVersion = {
    project_proposal_document_version_id: 'document-version-test-001',
    project_id: testProject.project_id,
    source_lead_id: testProject.source_lead_id,
    source_floral_proposal_id: 'proposal-test-001',
    invoice_snapshot_id: 'snapshot-test-001',
    version: 1,
    file_name: 'signed-proposal.pdf',
    storage_bucket: 'floral-proposals',
    storage_path: 'projects/project-test-001/proposal-documents/v1.pdf',
    content_type: 'application/pdf',
    file_size_bytes: 1024,
    uploaded_by: 'user-test-001',
    submitted_at: '2026-06-02T12:00:00.000Z',
    is_active: true,
    created_at: '2026-06-02T12:00:00.000Z',
  };

  beforeEach(async () => {
    projectRepository = jasmine.createSpyObj<ProjectRepositoryService>(
      'ProjectRepositoryService',
      ['getProjects']
    );
    documentRepository =
      jasmine.createSpyObj<ProjectProposalDocumentVersionRepositoryService>(
        'ProjectProposalDocumentVersionRepositoryService',
        ['getProjectDocumentVersions']
      );
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    storageApi = {
      createSignedUrl: jasmine.createSpy('createSignedUrl'),
    };

    projectRepository.getProjects.and.resolveTo([testProject]);
    documentRepository.getProjectDocumentVersions.and.resolveTo([documentVersion]);
    router.navigate.and.resolveTo(true);
    storageApi.createSignedUrl.and.resolveTo({
      data: { signedUrl: 'https://signed.example.test/proposal.pdf' },
      error: null,
    });

    await TestBed.configureTestingModule({
      imports: [ProjectsComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({}),
              queryParamMap: convertToParamMap({ projectId: testProject.project_id }),
            },
          },
        },
        { provide: Router, useValue: router },
        { provide: ProjectRepositoryService, useValue: projectRepository },
        {
          provide: ProjectProposalDocumentVersionRepositoryService,
          useValue: documentRepository,
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({
              storage: {
                from: jasmine.createSpy('from').and.returnValue(storageApi),
              },
            }),
          },
        },
      ],
    }).compileComponents();

    consoleErrorSpy = spyOn(console, 'error');
  });

  it('loads projects and signed proposal document history from repositories', async () => {
    createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.loading()).toBeFalse();
    expect(component.projects()).toEqual([testProject]);
    expect(component.selectedProject()?.project_id).toBe(testProject.project_id);
    expect(component.documentVersions()).toEqual([documentVersion]);
    expect(documentRepository.getProjectDocumentVersions).toHaveBeenCalledWith(
      testProject.project_id
    );
    expect(fixture.nativeElement.textContent).toContain(testProject.project_name);
    expect(fixture.nativeElement.textContent).toContain('signed-proposal.pdf');
  });

  it('opens signed proposal documents through private storage URLs', async () => {
    createComponent();
    await fixture.whenStable();
    const openSpy = spyOn(window, 'open');

    await component.openDocument(documentVersion);

    expect(storageApi.createSignedUrl).toHaveBeenCalledWith(
      documentVersion.storage_path,
      600
    );
    expect(openSpy).toHaveBeenCalledWith(
      'https://signed.example.test/proposal.pdf',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('routes project proposal revisions back through the source lead builder', async () => {
    createComponent();
    await fixture.whenStable();

    component.reviseProposal(testProject);

    expect(router.navigate).toHaveBeenCalledWith(
      ['/admin/leads', testProject.source_lead_id, 'floral-proposal-builder'],
      { queryParams: { projectId: testProject.project_id } }
    );
  });

  it('shows a friendly error when projects cannot be loaded', async () => {
    const error = new Error('load failed');
    projectRepository.getProjects.and.rejectWith(error);

    createComponent();
    await fixture.whenStable();

    expect(component.error()).toBe('We could not load projects right now.');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ProjectsComponent] loadProjects error:',
      error
    );
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(ProjectsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }
});
