import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ActivityRepositoryService } from '../../../../core/supabase/repositories/activity-repository.service';
import { LeadRepositoryService } from '../../../../core/supabase/repositories/lead-repository.service';
import { ProjectPaymentRecordRepositoryService } from '../../../../core/supabase/repositories/project-payment-record-repository.service';
import { ProjectProposalDocumentVersionRepositoryService } from '../../../../core/supabase/repositories/project-proposal-document-version-repository.service';
import { ProjectProposalInvoiceSnapshotRepositoryService } from '../../../../core/supabase/repositories/project-proposal-invoice-snapshot-repository.service';
import { ProjectRepositoryService } from '../../../../core/supabase/repositories/project-repository.service';
import { SupabaseService } from '../../../../core/supabase/clients/supabase.service';
import { ProjectProposalRevisionService } from '../../../../core/supabase/services/project-proposal-revision.service';
import { ProjectWorkflowService } from '../../../../core/supabase/services/project-workflow.service';
import { ProjectDetailsComponent } from './project-details.component';

describe('ProjectDetailsComponent active proposal contracts', () => {
  let component: ProjectDetailsComponent;
  const resolver = new ProjectProposalRevisionService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  const project = {
    project_id: 'project-1', project_name: 'Wedding', service_type: 'wedding', status: 'booked',
    active_proposal_invoice_snapshot_id: 'snapshot-2', active_proposal_document_version_id: 'document-2',
    created_at: '', updated_at: '',
  } as any;
  const snapshot = {
    project_proposal_invoice_snapshot_id: 'snapshot-2', project_id: 'project-1', version: 2, snapshot: {},
    subtotal: 100, tax_rate: .06, tax_amount: 6, total_amount: 106, retainer_amount: 30,
    final_balance_amount: 106, is_active: true, created_at: '',
  } as any;
  const document = {
    project_proposal_document_version_id: 'document-2', project_id: 'project-1', invoice_snapshot_id: 'snapshot-2',
    version: 2, file_name: 'v2.pdf', storage_bucket: 'floral-proposals', storage_path: 'v2.pdf',
    content_type: 'application/pdf', submitted_at: '', status: 'submitted', is_active: true, created_at: '',
  } as any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectDetailsComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'project-1' } } } },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
        { provide: ProjectRepositoryService, useValue: {} }, { provide: LeadRepositoryService, useValue: {} },
        { provide: ProjectPaymentRecordRepositoryService, useValue: {} }, { provide: ActivityRepositoryService, useValue: {} },
        { provide: ProjectProposalDocumentVersionRepositoryService, useValue: {} },
        { provide: ProjectProposalInvoiceSnapshotRepositoryService, useValue: {} },
        { provide: ProjectWorkflowService, useValue: {} }, { provide: SupabaseService, useValue: {} },
        { provide: ProjectProposalRevisionService, useValue: resolver },
      ],
    }).overrideComponent(ProjectDetailsComponent, { set: { template: '' } }).compileComponents();
    component = TestBed.createComponent(ProjectDetailsComponent).componentInstance;
    component.project.set(project);
  });

  it('uses only the exact project-pointer active snapshot and never latest history', () => {
    component.snapshots.set([{ ...snapshot, project_proposal_invoice_snapshot_id: 'snapshot-1', version: 1, is_active: false }, snapshot]);
    expect(component.activeSnapshot()).toBe(snapshot);
    component.project.set({ ...project, active_proposal_invoice_snapshot_id: 'missing' });
    expect(component.activeSnapshot()).toBeNull();
    expect(component.revisionDisabledReason()).toContain('does not match');
  });

  it('keeps revision eligible when only the active document is missing', () => {
    component.snapshots.set([snapshot]);
    component.documents.set([]);
    expect(component.revisionDisabledReason()).toBeNull();
    expect(component.activeDocument()).toBeNull();
    expect(component.documentDisabledReason()).toContain('could not be found');
  });

  it('requires the active document to link to the exact active snapshot', () => {
    component.snapshots.set([snapshot]);
    component.documents.set([{ ...document, invoice_snapshot_id: 'snapshot-1' }]);
    expect(component.activeDocument()).toBeNull();
    expect(component.documentDisabledReason()).toContain('does not match');
    component.documents.set([document]);
    expect(component.activeDocument()).toBe(document);
  });
});
